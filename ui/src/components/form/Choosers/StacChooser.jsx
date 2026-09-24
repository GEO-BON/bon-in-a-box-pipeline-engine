/* eslint-disable prettier/prettier */
import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Modal from "@mui/material/Modal";
import TextField from "@mui/material/TextField";
import DeleteIcon from "@mui/icons-material/Delete";
import ImageIcon from "@mui/icons-material/Image";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import { CustomButtonGreen, CustomButtonGrey } from "../../CustomMUI";
import { paperStyle } from "./utils";

// Served by python-api (main_api.py -> stac_api.py), proxied by nginx.
const STAC_URL = window.location.origin + "/stac";

// Titiler, in the same container, proxied by nginx. Its /stac endpoints read a
// STAC item and render one of its assets.
const TILER_URL = window.location.origin + "/tiler";

const ITEMS_PER_PAGE = 50;
const PREVIEW_MAX_SIZE = 512;
const PREVIEW_COLORMAP = "hot"; // matches the result map, see TiTilerLayer

async function getJson(path, params) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${STAC_URL}/${path}?${query}`);
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error page, fall through to the generic message below.
  }
  if (!response.ok) {
    throw new Error((body && body.detail) || `Request to ${path} failed (${response.status})`);
  }
  return body;
}

/** Titiler reports errors as {detail: "..."} or as a list of validation errors. */
function tilerMessage(body, status) {
  const detail = body && body.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  return `Tiler request failed (${status})`;
}

/**
 * Per-band statistics of one asset, as a flat list.
 *
 * Titiler nests them by asset and by band, in a shape that has changed between
 * versions, so pick out whatever nodes carry percentiles.
 */
function bandStatistics(body) {
  const bands = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.percentile_2 === "number" && typeof node.percentile_98 === "number") {
      bands.push(node);
    } else {
      Object.values(node).forEach(visit);
    }
  };
  visit(body);
  return bands;
}

/** The catalog value can be a chosen option or a URL typed by the user. */
function catalogUrl(catalog) {
  if (!catalog) return null;
  return typeof catalog === "string" ? catalog.trim() : catalog.url;
}

/** The input holds a list, but tolerate a lone object from an older run. */
function asSelections(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/** The UTC day a listed item falls on, in the same form as dates_list. */
function itemDay(item) {
  return item.datetime ? item.datetime.slice(0, 10) : null;
}

function selectionKey(selection) {
  return [
    selection.catalog,
    selection.collection,
    selection.date || "",
    selection.all_items ? "*" : selection.item,
    selection.asset,
  ].join("|");
}

/** How a selection reads in the lists, e.g. "all items on 2019-06-01". */
function selectionScope(selection) {
  if (!selection.all_items) return selection.item;
  return selection.date ? `all items on ${selection.date}` : "all items in the collection";
}

export default function StacChooser({ inputId, value = null, updateValue = () => {}, isCompact = false }) {
  const [openModal, setOpenModal] = useState(false);
  const selections = asSelections(value);

  return (
    <div className="chooserFieldBody">
      <CustomButtonGreen
        variant="contained"
        endIcon={<TravelExploreIcon />}
        onClick={() => setOpenModal(true)}
        className="locationChooserButton"
        style={{ marginBottom: "1rem", fontSize: "1rem", width: !isCompact && "500px" }}
      >
        {selections.length > 0 ? `Choose STAC assets (${selections.length})` : "Choose STAC assets"}
      </CustomButtonGreen>
      {selections.length > 0 && !isCompact && (
        <div style={{ fontSize: "0.8rem", color: "#555", marginBottom: "0.5rem" }}>
          {selections.map((selection) => (
            <div key={selectionKey(selection)}>
              <b>{selection.collection}</b> / {selection.asset} — {selectionScope(selection)}
            </div>
          ))}
        </div>
      )}
      <Modal
        key={`modal-stac-chooser-${inputId}`}
        open={openModal}
        onClose={() => setOpenModal(false)}
        aria-labelledby="stac-chooser-title"
      >
        <>
          {openModal && (
            <StacBrowser key={`stac-browser-${inputId}`} {...{ value, updateValue, setOpenModal }} />
          )}
        </>
      </Modal>
    </div>
  );
}

function StacBrowser({ value, updateValue, setOpenModal }) {
  const previousValue = useRef(value);
  // Catalog and collection of the last saved entry, restored so that the
  // browser reopens where it left off. Consumed as each list arrives.
  const toRestore = useRef(asSelections(value).slice(-1)[0] || null);
  // Same, for the date, which is only restorable once the date list has loaded.
  const dateToRestore = useRef(toRestore.current && toRestore.current.date);

  const [error, setError] = useState(null);
  const [selections, setSelections] = useState(asSelections(value));

  const [catalogs, setCatalogs] = useState([]);
  const [catalog, setCatalog] = useState(null);

  const [collections, setCollections] = useState([]);
  const [collection, setCollection] = useState(null);
  const [loadingCollections, setLoadingCollections] = useState(false);

  const [dates, setDates] = useState([]);
  const [date, setDate] = useState(null);
  const [datesTruncated, setDatesTruncated] = useState(false);
  // Items in the whole collection, or null when the walk stopped early and the
  // true total is unknown (but certainly large).
  const [collectionCount, setCollectionCount] = useState(null);
  const [datesError, setDatesError] = useState(null);
  const [loadingDates, setLoadingDates] = useState(false);

  const [items, setItems] = useState([]);
  const [item, setItem] = useState(null);
  const [allItems, setAllItems] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [filter, setFilter] = useState("");
  const [loadingItems, setLoadingItems] = useState(false);

  const [assets, setAssets] = useState([]);
  const [asset, setAsset] = useState(null);
  const [loadingAssets, setLoadingAssets] = useState(false);

  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const previewBlob = useRef(null);
  const previewRequest = useRef(0);

  const commit = (next) => {
    setSelections(next);
    updateValue(next.length > 0 ? next : null);
  };

  // Catalogs, and the catalog of the entry we are reopening on.
  useEffect(() => {
    let cancelled = false;
    getJson("catalogs_list")
      .then((list) => {
        if (cancelled) return;
        setCatalogs(list);
        const restoring = toRestore.current;
        if (restoring && restoring.catalog) {
          setCatalog(list.find((c) => c.url === restoring.catalog) || restoring.catalog);
        }
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  // Collections of the chosen catalog.
  useEffect(() => {
    const url = catalogUrl(catalog);
    setCollections([]);
    setCollection(null);
    if (!url) return;

    let cancelled = false;
    setLoadingCollections(true);
    setError(null);
    getJson("collections_list", { catalog: url })
      .then((list) => {
        if (cancelled) return;
        setCollections(list);
        const restoring = toRestore.current;
        toRestore.current = null; // nothing further is restored
        if (restoring && restoring.collection) {
          setCollection(list.find((c) => c.id === restoring.collection) || null);
        }
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadingCollections(false));
    return () => {
      cancelled = true;
    };
  }, [catalog]);

  // Dates covered by the chosen collection, so that a collection holding one
  // tile set per date can be narrowed to one of them.
  useEffect(() => {
    const url = catalogUrl(catalog);
    setDates([]);
    setDate(null);
    setDatesTruncated(false);
    setCollectionCount(null);
    setDatesError(null);
    if (!url || !collection) return;

    let cancelled = false;
    setLoadingDates(true);
    getJson("dates_list", { catalog: url, collection: collection.id })
      .then((result) => {
        if (cancelled) return;
        setDates(result.dates);
        setDatesTruncated(result.truncated);
        setCollectionCount(
          result.truncated
            ? null
            : result.dates.reduce((total, d) => total + d.count, 0) + result.undated,
        );
        const restoring = dateToRestore.current;
        dateToRestore.current = null;
        if (restoring) setDate(result.dates.find((d) => d.date === restoring) || null);
      })
      // Browsing still works without dates, so report this next to the selector
      // rather than as an error over the whole chooser.
      .catch((e) => !cancelled && setDatesError(e.message))
      .finally(() => !cancelled && setLoadingDates(false));
    return () => {
      cancelled = true;
    };
  }, [catalog, collection]);

  // One page of items. Skipped in "all items" mode, where no item is listed.
  useEffect(() => {
    const url = catalogUrl(catalog);
    if (!url || !collection || allItems) {
      setItems([]);
      setHasNext(false);
      return;
    }

    let cancelled = false;
    setLoadingItems(true);
    const timer = setTimeout(
      () => {
        getJson("items_list", {
          catalog: url,
          collection: collection.id,
          limit: ITEMS_PER_PAGE,
          page,
          filter,
          date: date ? date.date : "",
        })
          .then((result) => {
            if (cancelled) return;
            setItems(result.items);
            setHasNext(result.has_next);
          })
          .catch((e) => !cancelled && setError(e.message))
          .finally(() => !cancelled && setLoadingItems(false));
      },
      filter ? 300 : 0, // debounce typing, but load the first page immediately
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [catalog, collection, page, filter, allItems, date]);

  // Assets of the chosen item, or of a sample item in "all items" mode.
  useEffect(() => {
    const url = catalogUrl(catalog);
    setAssets([]);
    setAsset(null);
    if (!url || !collection || (!item && !allItems)) return;

    let cancelled = false;
    setLoadingAssets(true);
    setError(null);
    getJson("assets_list", {
      catalog: url,
      collection: collection.id,
      item: allItems ? "" : item.id,
      date: allItems && date ? date.date : "",
    })
      .then((list) => {
        if (cancelled) return;
        setAssets(list);
        // A lone asset leaves no choice to make, so make it for the user.
        if (list.length === 1) setAsset(list[0]);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadingAssets(false));
    return () => {
      cancelled = true;
    };
  }, [catalog, collection, item, allItems, date]);

  // A preview belongs to one asset, so drop it as soon as the choice moves.
  useEffect(() => {
    previewRequest.current += 1; // abandons a render still in flight
    if (previewBlob.current) {
      URL.revokeObjectURL(previewBlob.current);
      previewBlob.current = null;
    }
    setPreview(null);
    setPreviewError(null);
    setLoadingPreview(false);
  }, [catalog, collection, item, allItems, date, asset]);

  useEffect(
    () => () => {
      if (previewBlob.current) URL.revokeObjectURL(previewBlob.current);
    },
    [],
  );

  // In "all items" mode the assets, and so the preview, come from a sample item.
  const previewItemUrl = asset && (allItems ? asset.item_url : item && item.url);

  const expandedUrl =
    previewItemUrl &&
    `${TILER_URL}/stac/WebMercatorQuad/map.html?` +
      (preview ? preview.params : new URLSearchParams({ url: previewItemUrl, assets: asset.key }));

  const loadPreview = async () => {
    const request = previewRequest.current;
    const stale = () => request !== previewRequest.current;

    setLoadingPreview(true);
    setPreviewError(null);
    try {
      // Kept with the image: the expanded view renders it the same way.
      const params = new URLSearchParams({ url: previewItemUrl, assets: asset.key });

      // Measured data renders black without a range, so scale on the asset's own
      // percentiles, as the result map does. A missing range is not fatal: byte
      // imagery renders fine without one.
      let bands = [];
      try {
        const response = await fetch(
          `${TILER_URL}/stac/statistics?${new URLSearchParams({ url: previewItemUrl, assets: asset.key })}`,
        );
        if (response.ok) bands = bandStatistics(await response.json());
      } catch {
        // Leave the rescale out and let the tiler do what it can.
      }
      if (stale()) return;
      bands.forEach((band) => params.append("rescale", `${band.percentile_2},${band.percentile_98}`));
      // A colormap only makes sense on a single band; a 3-band asset is RGB.
      if (bands.length === 1) params.set("colormap_name", PREVIEW_COLORMAP);

      const rendered = await fetch(
        `${TILER_URL}/stac/preview.png?${params}&max_size=${PREVIEW_MAX_SIZE}`,
      );
      if (!rendered.ok) {
        let body = null;
        try {
          body = await rendered.json();
        } catch {
          // Not a JSON error page, fall through to the generic message.
        }
        throw new Error(tilerMessage(body, rendered.status));
      }
      const blob = await rendered.blob();
      if (stale()) return;
      previewBlob.current = URL.createObjectURL(blob);
      // Carries its own label: the chosen asset can be cleared (by "Add to
      // selection", say) in a render where the image is still on screen.
      setPreview({
        url: previewBlob.current,
        label: `Preview of ${asset.key}`,
        params: params.toString(),
      });
    } catch (e) {
      if (!stale()) setPreviewError(e.message);
    } finally {
      if (!stale()) setLoadingPreview(false);
    }
  };

  const addSelection = () => {
    const entry = {
      catalog: catalogUrl(catalog),
      collection: collection.id,
      // The day in scope: chosen alongside all_items, or the one the item covers.
      date: allItems ? (date ? date.date : null) : itemDay(item),
      item: allItems ? null : item.id,
      all_items: allItems,
      asset: asset.key,
      href: allItems ? null : asset.href,
      type: asset.type,
    };
    if (selections.some((existing) => selectionKey(existing) === selectionKey(entry))) {
      setError("That asset is already in the list.");
      return;
    }
    commit([...selections, entry]);
    // Keep the catalog and collection so the next one is a couple of clicks away.
    setItem(null);
    setAsset(null);
  };

  // Tiles in what is currently in scope: one date's worth, or the collection.
  // Null means unknown, in which case assume there are several.
  const tileCount = date ? date.count : collectionCount;
  // Nothing to stitch when the scope holds a single tile, so the option goes.
  const canMosaic = tileCount === null || tileCount > 1;

  // Mosaicking every tile yields one layer only if the tiles share a date, so a
  // collection spanning several dates has to be narrowed to one first.
  const needsDate = allItems && dates.length > 1 && !date;
  const canAdd = Boolean(collection && asset && (item || allItems) && !needsDate);

  // Picking a date with a lone tile hides the option, which must not stay on.
  useEffect(() => {
    if (!canMosaic) setAllItems(false);
  }, [canMosaic]);

  return (
    <div
      className="location-chooser-modal"
      style={{
        width: "70%",
        maxWidth: "900px",
        maxHeight: "90%",
        overflowY: "auto",
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: "#fff",
        padding: "20px",
        borderRadius: "8px",
      }}
    >
      <h4 id="stac-chooser-title" style={{ marginTop: 0 }}>
        Choose assets from a STAC catalog
      </h4>

      {error && (
        <Alert severity="error" className="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div style={paperStyle(true)}>
        <Autocomplete
          freeSolo
          options={catalogs}
          value={catalog}
          size="small"
          sx={{ background: "#fff", borderRadius: "4px" }}
          getOptionLabel={(option) => (typeof option === "string" ? option : option.label || "")}
          isOptionEqualToValue={(option, selected) => option.url === catalogUrl(selected)}
          renderInput={(params) => (
            <TextField {...params} label="Catalog (choose one, or paste a catalog URL)" />
          )}
          onChange={(_, chosen) => setCatalog(chosen)}
          onBlur={(event) => {
            // freeSolo keeps typed text out of the value until it is committed.
            const typed = event.target.value.trim();
            if (typed && typed !== catalogUrl(catalog) && !catalogs.some((c) => c.label === typed)) {
              setCatalog(typed);
            }
          }}
        />
      </div>

      <div style={paperStyle(true)}>
        <Autocomplete
          options={collections}
          value={collection}
          disabled={!catalog || loadingCollections}
          loading={loadingCollections}
          size="small"
          sx={{ background: "#fff", borderRadius: "4px" }}
          getOptionLabel={(option) => option.title || option.id || ""}
          isOptionEqualToValue={(option, selected) => option.id === selected.id}
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              <ListItemText primary={option.title} secondary={option.id} />
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Collection"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loadingCollections && <CircularProgress size="14px" />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          onChange={(_, chosen) => {
            setCollection(chosen);
            dateToRestore.current = null; // a hand-picked collection is not a reopen
            setItem(null);
            setPage(1);
            setFilter("");
          }}
        />
      </div>

      <div style={paperStyle(true)}>
        {(dates.length > 1 || loadingDates || datesError) && (
          <>
            <Autocomplete
              options={dates}
              value={date}
              disabled={!collection || loadingDates || dates.length === 0}
              loading={loadingDates}
              size="small"
              sx={{ background: "#fff", borderRadius: "4px", marginBottom: "8px" }}
              getOptionLabel={(option) => option.date || ""}
              isOptionEqualToValue={(option, selected) => option.date === selected.date}
              renderOption={(props, option) => (
                <li {...props} key={option.date}>
                  <ListItemText
                    primary={option.date}
                    secondary={`${option.count} item${option.count === 1 ? "" : "s"}`}
                  />
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={loadingDates ? "Date" : `Date (${dates.length} in this collection)`}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingDates && <CircularProgress size="14px" />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              onChange={(_, chosen) => {
                setDate(chosen);
                setItem(null);
                setPage(1);
              }}
            />
            {datesTruncated && (
              <p style={{ fontSize: "11px", margin: "0px 0px 6px 5px", color: "#555" }}>
                This collection is large, so only the dates of its first items are listed.
              </p>
            )}
            {datesError && (
              <p style={{ fontSize: "11px", margin: "0px 0px 6px 5px", color: "#a33" }}>
                Dates could not be listed ({datesError}). Every item is still browsable below.
              </p>
            )}
          </>
        )}

        {canMosaic && (
          <FormControlLabel
            control={
              <Checkbox
                checked={allItems}
                disabled={!collection}
                onChange={(e) => {
                  setAllItems(e.target.checked);
                  setItem(null);
                  setPage(1);
                }}
              />
            }
            label={
              date
                ? `Mosaic all ${date.count} tiles on ${date.date}`
                : dates.length > 1
                  ? "Mosaic all tiles on one date"
                  : `Mosaic all ${collectionCount === null ? "" : `${collectionCount} `}tiles in this collection`
            }
          />
        )}

        {!allItems && (
          <>
            <TextField
              label="Filter items by id"
              size="small"
              fullWidth
              disabled={!collection}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
              sx={{ marginBottom: "8px" }}
            />
            <List
              dense
              style={{
                maxHeight: "200px",
                overflowY: "auto",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              {loadingItems && (
                <ListItemText style={{ padding: "8px" }} primary={<CircularProgress size="14px" />} />
              )}
              {!loadingItems && items.length === 0 && (
                <ListItemText
                  style={{ padding: "8px", color: "#888" }}
                  primary={collection ? "No items match." : "Choose a collection first."}
                />
              )}
              {!loadingItems &&
                items.map((listed) => (
                  <ListItemButton
                    key={listed.id}
                    selected={Boolean(item) && item.id === listed.id}
                    onClick={() => setItem(listed)}
                  >
                    <ListItemText primary={listed.id} secondary={listed.datetime} />
                  </ListItemButton>
                ))}
            </List>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px" }}>
              <CustomButtonGrey disabled={page <= 1 || loadingItems} onClick={() => setPage(page - 1)}>
                Previous
              </CustomButtonGrey>
              <span style={{ fontSize: "0.8rem" }}>Page {page}</span>
              <CustomButtonGrey disabled={!hasNext || loadingItems} onClick={() => setPage(page + 1)}>
                Next
              </CustomButtonGrey>
            </div>
          </>
        )}
      </div>

      <div style={{ ...paperStyle(true), display: "flex", gap: "12px", alignItems: "stretch" }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <Autocomplete
            options={assets}
            value={asset}
            disabled={(!item && !allItems) || loadingAssets}
            loading={loadingAssets}
            size="small"
            sx={{ background: "#fff", borderRadius: "4px" }}
            getOptionLabel={(option) => option.title || option.key || ""}
            isOptionEqualToValue={(option, selected) => option.key === selected.key}
            renderOption={(props, option) => (
              <li {...props} key={option.key}>
                <ListItemText primary={option.title} secondary={option.type || option.key} />
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Asset"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingAssets && <CircularProgress size="14px" />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            onChange={(_, chosen) => setAsset(chosen)}
          />
          {needsDate && (
            <p style={{ fontSize: "11px", margin: "4px 0px 2px 5px", color: "#a33" }}>
              This collection spans {dates.length} dates. Choose one above, so that the tiles mosaic
              into a single layer.
            </p>
          )}
          {allItems && !needsDate && assets.length > 0 && (
            <p style={{ fontSize: "11px", margin: "4px 0px 2px 5px", color: "#555" }}>
              Asset names read from a sample item. The script receives the collection, the asset name
              {date ? ` and the date ${date.date}` : ""}, and mosaics the tiles itself.
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", marginTop: "8px" }}>
            <CustomButtonGreen disabled={!canAdd} endIcon={<PlaylistAddIcon />} onClick={addSelection}>
              Add to selection
            </CustomButtonGreen>
            <CustomButtonGrey
              disabled={!previewItemUrl || loadingPreview}
              endIcon={<ImageIcon />}
              onClick={loadPreview}
            >
              Preview
            </CustomButtonGrey>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            flex: "0 0 260px",
            minHeight: "180px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "6px",
            textAlign: "center",
            border: "1px solid #ddd",
            borderRadius: "4px",
            background: "#fafafa",
          }}
        >
          {expandedUrl && (
            <IconButton
              size="small"
              title="Open this asset in the tiler's map"
              aria-label="Open this asset in the tiler's map"
              href={expandedUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                position: "absolute",
                top: "2px",
                right: "2px",
                zIndex: 1,
                background: "#fffc",
              }}
            >
              <OpenInFullIcon fontSize="small" />
            </IconButton>
          )}
          {loadingPreview ? (
            <CircularProgress size="20px" />
          ) : previewError ? (
            <span style={{ fontSize: "0.75rem", color: "#a33" }}>{previewError}</span>
          ) : preview ? (
            <img src={preview.url} alt={preview.label} style={{ maxWidth: "100%", maxHeight: "240px" }} />
          ) : (
            <span style={{ fontSize: "0.75rem", color: "#888" }}>
              {!asset
                ? "Choose an asset to preview it."
                : previewItemUrl
                  ? 'Use "Preview" to render this asset.'
                  : "This catalog does not say where the item lives, so it cannot be previewed."}
            </span>
          )}
        </div>
      </div>

      <Divider style={{ margin: "10px 0px" }} />

      <div style={paperStyle(true)}>
        <h4 style={{ marginTop: "3px", marginBottom: "6px" }}>
          Selected assets ({selections.length})
        </h4>
        {selections.length === 0 ? (
          <p style={{ fontSize: "0.8rem", color: "#888", margin: "4px 5px" }}>
            Nothing selected yet. Pick an item and an asset above, then use "Add to selection".
          </p>
        ) : (
          <List dense style={{ maxHeight: "180px", overflowY: "auto" }}>
            {selections.map((selection, index) => (
              <ListItem
                key={selectionKey(selection)}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label={`Remove ${selection.asset}`}
                    onClick={() => commit(selections.filter((_, i) => i !== index))}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={`${selection.collection} / ${selection.asset}`}
                  secondary={selectionScope(selection)}
                />
              </ListItem>
            ))}
          </List>
        )}
      </div>

      <div>
        <CustomButtonGreen onClick={() => setOpenModal(false)}>Accept</CustomButtonGreen>
        <CustomButtonGreen
          onClick={() => {
            commit([]);
            setItem(null);
            setAsset(null);
            setAllItems(false);
            setDate(null);
            setPage(1);
            setFilter("");
          }}
        >
          Clear
        </CustomButtonGreen>
        <CustomButtonGreen
          onClick={() => {
            setOpenModal(false);
            updateValue(previousValue.current);
          }}
        >
          Cancel
        </CustomButtonGreen>
      </div>
    </div>
  );
}
