"""
STAC catalogue browsing endpoints, backing the STAC chooser in the UI.

Mounted by main_api.py on the uvicorn app (port 8001), proxied at /stac/.
"""

import ipaddress
import socket
import time
from datetime import date as date_type
from datetime import datetime as datetime_type
from datetime import timezone
from functools import lru_cache
from itertools import islice
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from pystac_client import Client

router = APIRouter(prefix="/stac")

# Catalogues offered in the chooser's dropdown. Users may also type any other
# public catalogue URL, which goes through _assert_public_url below.
STAC_CATALOGS = {
    "geobon": ("GEO BON STAC", "https://stac.geobon.org"),
    "bq-io": ("Biodiversité Québec", "https://io.biodiversite-quebec.ca/stac2/"),
    "planetary-computer": ("Planetary Computer", "https://planetarycomputer.microsoft.com/api/stac/v1"),
}

# Highest number of items a single page may request.
MAX_LIMIT = 200

# Listing a collection's dates means walking its items, so stop after this many
# and tell the caller the list is partial.
MAX_DATE_SCAN = 5000

# Page size used for that walk, to keep the number of round trips down.
DATE_SCAN_PAGE_SIZE = 500

# Collection lists change rarely and a cold catalogue can take seconds to list.
CACHE_TTL_SECONDS = 300
_cache = {}


def _cached(key, producer):
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < CACHE_TTL_SECONDS:
        return hit[1]
    value = producer()
    _cache[key] = (now, value)
    return value


def _assert_public_url(url):
    """
    Guard for user-supplied catalogue URLs.

    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Catalog URL must start with http:// or https://")

    try:
        addresses = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Catalog host '%s' could not be resolved" % parsed.hostname)

    for info in addresses:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise HTTPException(
                status_code=400,
                detail="Catalog URL must resolve to a public address (got %s)" % ip,
            )


def resolve_catalog(catalog):
    """Turn a catalog query parameter (an allowlist key, or a URL) into a URL."""
    if not catalog:
        raise HTTPException(status_code=400, detail="A catalog is required")
    if catalog in STAC_CATALOGS:
        return STAC_CATALOGS[catalog][1]
    _assert_public_url(catalog)
    return catalog


@lru_cache(maxsize=16)
def _open(url):
    return Client.open(url)


def _client(catalog):
    url = resolve_catalog(catalog)
    try:
        return _open(url)
    except Exception as e:
        # Wrong URL, catalogue down, or valid JSON that isn't STAC.
        raise HTTPException(status_code=502, detail="Could not open STAC catalog %s: %s" % (url, e))


def _collection(catalog, collection):
    if not collection:
        raise HTTPException(status_code=400, detail="A collection is required")
    try:
        found = _client(catalog).get_collection(collection)
    except HTTPException:
        raise
    except Exception:
        found = None
    if found is None:
        raise HTTPException(status_code=404, detail="Collection '%s' not found in this catalog" % collection)
    return found


def _declared_assets(catalog, collection):
    """The collection's item_assets declaration, or {} when it has none."""
    return getattr(_collection(catalog, collection), "item_assets", None) or {}


def _isoformat(value):
    return value.isoformat() if value is not None else None


def _is_cog(media_type):
    """
    Whether a media type names a Cloud Optimized GeoTIFF, the only format the
    tiler previews and the scripts read. Parameters may come in any order, case
    or spacing, so compare them as a set.
    """
    if not media_type:
        return False
    parts = {part.strip().lower().replace(" ", "") for part in media_type.split(";")}
    return "image/tiff" in parts and "profile=cloud-optimized" in parts


def _asset_fields(asset, declared=None):
    """
    An asset's fields as plain JSON, over what the collection's item_assets
    declares for it. Catalogues put the raster and classification extensions in
    either place, so the item's own fields win and the declaration fills gaps.
    """
    fields = declared.to_dict() if declared is not None else {}
    fields.update(asset.to_dict())
    return fields


def _classes(fields):
    """
    The classes a categorical asset declares, as [{value, label, color}], or None.

    Two extensions describe them: classification:classes (on the asset or its
    first band) and the older file:values, which maps value lists to a summary.
    """
    bands = fields.get("raster:bands") or fields.get("bands") or [{}]
    declared = fields.get("classification:classes") or bands[0].get("classification:classes")
    if declared:
        return [
            {
                "value": c.get("value"),
                "label": c.get("description") or c.get("title") or c.get("name"),
                "color": "#" + c["color_hint"] if c.get("color_hint") else None,
            }
            for c in declared
        ]
    values = fields.get("file:values")
    if values:
        return [{"value": v, "label": entry.get("summary"), "color": None} for entry in values for v in entry.get("values", [])]
    return None


def _kind(fields, classes):
    """
    Whether an asset is categorical or continuous, or None when the catalogue
    doesn't say. A class list settles it. So does anything that marks a measured
    quantity: a float data type, a scale or offset, a unit, or spectral bands.
    An integer type alone doesn't: land cover and scaled temperatures are both
    stored as integers.
    """
    if classes:
        return "categorical"
    if fields.get("eo:bands"):
        return "continuous"
    bands = fields.get("raster:bands") or fields.get("bands") or []
    types = {band.get("data_type") for band in bands} - {None}
    if types and all(t.startswith(("float", "cfloat")) for t in types):
        return "continuous"
    for band in bands:
        if band.get("scale") not in (None, 1) or band.get("offset") not in (None, 0) or band.get("unit"):
            return "continuous"
    return None


def _describe_asset(key, asset, sampled=None, declared=None):
    fields = _asset_fields(asset, declared)
    classes = _classes(fields)
    described = {
        "key": key,
        "title": asset.title or key,
        # item_assets definitions (ItemAssetDefinition) carry no href.
        "href": getattr(asset, "href", None),
        "type": asset.media_type,
        "roles": asset.roles or [],
        "kind": _kind(fields, classes),
        "classes": classes,
    }
    if sampled is not None:
        # The href belongs to the sampled item, not to a user selection. Its URL
        # is what the tiler reads to preview the asset.
        described["sampled_from"] = sampled.id
        described["item_url"] = sampled.get_self_href()
    return described


def _assert_date(date):
    """A date query parameter, as a plain YYYY-MM-DD string."""
    try:
        return date_type.fromisoformat(date).isoformat()
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be written as YYYY-MM-DD (got '%s')" % date)


def _rfc3339(text):
    """Parse a STAC timestamp. Its 'Z' suffix predates fromisoformat's support."""
    if not isinstance(text, str):
        return None
    try:
        return datetime_type.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _item_day(item):
    """
    The UTC day an item starts on, matching how _iter_items filters by date.

    Items covering a period -- an annual land cover composite, say -- have no
    single datetime; STAC puts their range in start_datetime/end_datetime. A
    query for the start day intersects that range, so key them on it.
    """
    moment = item.datetime
    if moment is None:
        moment = _rfc3339((getattr(item, "properties", None) or {}).get("start_datetime"))
    if moment is None:
        return None
    if moment.tzinfo is not None:
        moment = moment.astimezone(timezone.utc)
    return moment.date().isoformat()


def _iter_items(catalog, collection, date="", page_size=None):
    """
    Yield the items of a collection, newest API path first.

    Item search is the efficient route and is what STAC APIs advertise, but
    static catalogues don't implement it, so fall back to walking the collection.
    A date narrows the stream to that whole UTC day, server-side where possible.
    """
    client = _client(catalog)
    query = {"collections": [collection]}
    if date:
        query["datetime"] = "%sT00:00:00Z/%sT23:59:59Z" % (date, date)
    if page_size:
        query["limit"] = page_size
    try:
        return client.search(**query).items()
    except Exception:
        items = _collection(catalog, collection).get_items()
        if date:
            # The static path has no server-side filter, so do it here.
            items = (item for item in items if _item_day(item) == date)
        return items


@router.get("/catalogs_list")
def catalogs_list():
    """The configured catalogues, for the chooser's dropdown."""
    return [{"key": key, "label": label, "url": url} for key, (label, url) in STAC_CATALOGS.items()]


@router.get("/collections_list")
def collections_list(catalog: str):
    """
    All collections in a catalog.

    Note that /collections is itself paginated (stac.geobon.org serves 10 at a
    time); get_collections() follows those links, so this returns the full list.
    """

    def load():
        try:
            collections = list(_client(catalog).get_collections())
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail="Could not list collections: %s" % e)

        described = []
        for c in collections:
            spatial = c.extent.spatial.bboxes if c.extent and c.extent.spatial else None
            temporal = c.extent.temporal.intervals if c.extent and c.extent.temporal else None
            described.append(
                {
                    "id": c.id,
                    "title": c.title or c.id,
                    "description": c.description,
                    "bbox": spatial[0] if spatial else None,
                    "interval": [_isoformat(t) for t in temporal[0]] if temporal else None,
                }
            )
        described.sort(key=lambda c: c["title"].lower())
        return described

    return _cached(("collections", resolve_catalog(catalog)), load)


@router.get("/dates_list")
def dates_list(catalog: str, collection: str):
    """
    The distinct dates a collection's items fall on, with how many items each holds.

    There is no standard way to ask a STAC API for this, so walk the items and
    count. The walk is capped at MAX_DATE_SCAN items; when it stops early the
    answer is marked truncated so the chooser can say the list is partial.
    """

    def load():
        counts = {}
        undated = 0
        truncated = False
        try:
            stream = _iter_items(catalog, collection, page_size=DATE_SCAN_PAGE_SIZE)
            for scanned, item in enumerate(stream):
                if scanned >= MAX_DATE_SCAN:
                    truncated = True
                    break
                day = _item_day(item)
                if day is None:
                    undated += 1
                else:
                    counts[day] = counts.get(day, 0) + 1
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail="Could not list dates of '%s': %s" % (collection, e))

        return {
            "dates": [{"date": day, "count": counts[day]} for day in sorted(counts)],
            "undated": undated,
            "truncated": truncated,
        }

    return _cached(("dates", resolve_catalog(catalog), collection), load)


@router.get("/items_list")
def items_list(catalog: str, collection: str, limit: int = 50, page: int = 1, filter: str = "", date: str = ""):
    """
    One page of items from a collection.

    Paging is by offset over the item stream so that it behaves the same for
    STAC APIs and static catalogues. One extra item is read to know whether a
    next page exists without counting the whole collection.
    """
    if limit < 1 or limit > MAX_LIMIT:
        raise HTTPException(status_code=400, detail="limit must be between 1 and %d" % MAX_LIMIT)
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be 1 or more")

    needle = filter.strip().lower()
    offset = (page - 1) * limit
    day = _assert_date(date) if date else ""

    try:
        stream = _iter_items(catalog, collection, date=day)
        if needle:
            stream = (item for item in stream if needle in item.id.lower())
        window = list(islice(stream, offset, offset + limit + 1))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail="Could not list items of '%s': %s" % (collection, e))

    if not window and page == 1 and not needle and not day:
        _collection(catalog, collection)

    has_next = len(window) > limit
    return {
        "items": [
            {
                "id": i.id,
                "datetime": _isoformat(i.datetime) or (getattr(i, "properties", None) or {}).get("start_datetime"),
                "bbox": i.bbox,
                "url": i.get_self_href(),
            }
            for i in window[:limit]
        ],
        "page": page,
        "has_next": has_next,
    }


@router.get("/assets_list")
def assets_list(catalog: str, collection: str, item: str = "", date: str = ""):
    """
    The Cloud Optimized GeoTIFF assets of an item. Other formats are left out.

    With no item, describe the assets the collection's items are expected to
    carry -- what the chooser needs for its "use all items" mode. The
    item_assets declaration is the authoritative source when present, but most
    collections omit it, so fall back to sampling the first item, from the given
    date when there is one.
    """
    if item:
        try:
            found = next(_client(catalog).search(collections=[collection], ids=[item]).items(), None)
        except HTTPException:
            raise
        except Exception:
            found = _collection(catalog, collection).get_item(item)
        if found is None:
            raise HTTPException(status_code=404, detail="Item '%s' not found in '%s'" % (item, collection))
        declared = _declared_assets(catalog, collection)
        return [
            _describe_asset(key, asset, declared=declared.get(key))
            for key, asset in found.assets.items()
            if _is_cog(asset.media_type)
        ]

    day = _assert_date(date) if date else ""

    # A sample item is needed either way: item_assets carries no href, and the
    # chooser previews the asset by reading a real item through the tiler.
    try:
        sample = next(_iter_items(catalog, collection, date=day), None)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail="Could not read an item of '%s': %s" % (collection, e))
    if sample is None:
        if day:
            raise HTTPException(
                status_code=404, detail="Collection '%s' has no items on %s" % (collection, day)
            )
        raise HTTPException(status_code=404, detail="Collection '%s' has no items" % collection)

    declared = _declared_assets(catalog, collection)
    if declared:
        # Prefer the sample's own asset, which has the href the tiler needs;
        # the declaration only fills in keys the sample happens to lack.
        candidates = ((key, sample.assets.get(key, asset)) for key, asset in declared.items())
    else:
        candidates = sample.assets.items()
    return [
        _describe_asset(key, asset, sampled=sample, declared=declared.get(key))
        for key, asset in candidates
        if _is_cog(asset.media_type)
    ]
