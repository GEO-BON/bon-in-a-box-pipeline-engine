from fastapi import HTTPException, File, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from clamav_client.clamd import BufferTooLongError, ClamdNetworkSocket
import os

# --- Antivirus -------------------------------------------------------------
# clamd used to run inside this container. It is a shared service now: on the cluster
# one container on the dispatcher VM serves every session, and locally it is whatever
# CLAMAV_ADDRESS names, or nothing at all. Its signature set is ~1.5GB resident and
# identical everywhere, so one copy replaces one per awake session.
#
# UNSET DISABLES SCANNING ENTIRELY, and that is a supported configuration -- a laptop,
# a CI run, an instance whose uploads are not exposed to anyone else. Uploads are then
# saved exactly as they were before any of this existed.
#
# SET, IT FAILS CLOSED. A configured clamd that cannot be reached REFUSES the upload.
# This is the opposite of what this code used to do: it caught every exception, logged
# a line nobody reads, and saved the file anyway -- so the only two outcomes were
# "clean" and "unscanned but saved", and an operator who had configured antivirus had
# no way to tell which one they were in. The cost is that a clamd outage is now an
# upload outage for every session at once; GET /api/status reports both the
# configuration and the reachability so that is visible before a user finds out.
CLAMAV_DEFAULT_PORT = 3310
# An upload holds a request open for the whole scan. Bounded so that a host which
# blackholes rather than refuses returns 503 instead of hanging the request forever --
# without this the fail-closed path is worse than the failure it replaces.
CLAMAV_TIMEOUT_SECONDS = 60.0


def _parse_clamav_address(address: str):
    """`host[:port]` -> `(host, port)`. None when unset or unparseable."""
    if not address:
        return None
    if "://" in address:
        # clamd speaks its own line protocol, not HTTP. Worth naming explicitly
        # because OLLAMA_URL, the setting this one is modelled on, IS a URL -- and
        # without this the scheme would be parsed as part of the hostname and every
        # upload would fail closed against a host that cannot resolve.
        print(
            f"[clamav] CLAMAV_ADDRESS={address!r} has a URL scheme; clamd is not HTTP. "
            f"Use host:port, e.g. {address.split('://', 1)[1]!r}. "
            "ANTIVIRUS IS DISABLED, uploads will not be scanned",
            flush=True,
        )
        return None
    host, sep, port = address.rpartition(":")
    if not sep:
        return address, CLAMAV_DEFAULT_PORT
    try:
        return host, int(port)
    except ValueError:
        # Disabled rather than half-configured, and loud about it: a typo must never
        # become "antivirus on, pointed at nothing", which under fail-closed would
        # refuse every upload on the instance.
        print(
            f"[clamav] CLAMAV_ADDRESS={address!r} is not host[:port] -- "
            "ANTIVIRUS IS DISABLED, uploads will not be scanned",
            flush=True,
        )
        return None


CLAMAV_ADDRESS = os.environ.get("CLAMAV_ADDRESS", "").strip()
CLAMAV_ENDPOINT = _parse_clamav_address(CLAMAV_ADDRESS)
ANTIVIRUS_ENABLED = CLAMAV_ENDPOINT is not None
print(
    f"[clamav] scanning uploads via {CLAMAV_ADDRESS}"
    if ANTIVIRUS_ENABLED
    else "[clamav] no CLAMAV_ADDRESS -- uploads are NOT scanned",
    flush=True,
)


def _clamav_client() -> ClamdNetworkSocket:
    host, port = CLAMAV_ENDPOINT
    return ClamdNetworkSocket(host=host, port=port, timeout=CLAMAV_TIMEOUT_SECONDS)


def _sync_scan(fileobj) -> dict:
    """Stream one upload to clamd. Runs in a threadpool worker; the socket is sync."""
    result = _clamav_client().instream(fileobj)
    print(f"[clamav] result for upload: {result}", flush=True)
    return result


async def scan_file_buffer(file: UploadFile = File(...)) -> UploadFile:
    """FastAPI dependency: scan an incoming multipart file before it is written.

    The file object is handed to clamd as a stream rather than read into memory
    first. That is not a micro-optimisation: the gateway accepts 10G bodies, and
    `await file.read()` put the whole of one on the heap. UploadFile.file is a
    SpooledTemporaryFile that spills to disk, and instream() reads it in chunks, which
    is what lets the session pod run with a 1Gi limit.
    """
    if not ANTIVIRUS_ENABLED:
        return file

    await file.seek(0)
    try:
        result = await run_in_threadpool(_sync_scan, file.file)
    except BufferTooLongError as exc:
        # The client knew the limit and refused to send. Distinct from an outage, and
        # answering 503 would send an operator looking in the wrong place.
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File is larger than the antivirus can scan, so it was refused. "
                   "Raise StreamMaxLength on the scanner to allow it.",
        ) from exc
    except Exception as exc:
        # FAIL CLOSED. 503 rather than 500: this is "the file was not scanned", not
        # "your request was malformed".
        #
        # The message names both causes on purpose. Measured against a real clamd:
        # when a stream exceeds StreamMaxLength the SERVER closes the connection
        # mid-send, which arrives here as BrokenPipeError, not BufferTooLongError --
        # indistinguishable from clamd having died. Claiming "unavailable" outright
        # would be wrong half the time, and the half it is wrong about is the one an
        # operator can actually fix.
        print(f"[clamav] scan failed against {CLAMAV_ADDRESS}: {exc!r}", flush=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The upload could not be scanned, so it was refused. Either the "
                   "antivirus is unreachable, or the file exceeds the scanner's "
                   "StreamMaxLength. See GET /api/status and the python-api log.",
        ) from exc
    finally:
        await file.seek(0)

    status_type, detail = (result or {}).get("stream", (None, None))
    if status_type == "FOUND":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Malware detected! File blocked by antivirus: {detail}",
        )
    if status_type == "ERROR":
        # clamd answered, but did not scan. The old code only looked for FOUND, so
        # this fell through as though the file were clean.
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File could not be scanned by the antivirus: {detail}",
        )
    return file
