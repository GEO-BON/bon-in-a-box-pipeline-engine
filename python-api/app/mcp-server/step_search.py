"""Finding the right script or pipeline, without reading the whole catalogue aloud.

`getListOf` returns `{path: name}` and nothing else (Routing.kt, `get("/{type}/list")`),
so the only way to answer "which pipeline computes forest cover loss?" from it is to hand
the model all 99 names and let it guess a path to call `get_info` on. It guesses on the
name alone, because the names are all it was given, and a wrong guess costs a whole
round -- one generation, with the full prompt and toolset resent -- to discover.

So this builds the index the list endpoint does not: name, path and description together,
ranked by the same BM25 the documentation search uses (bm25.py), returning the few steps
that actually match plus a one-line summary of each.

The metadata has to come over HTTP. python-api mounts `output/` and `userdata/` but not
`scripts/` or `pipelines/` (compose.yml), so unlike run_report.py this cannot read the
repository off disk: it is `getListOf` for both types, then `/info` on each of the 99.
That is slow enough to matter once and not worth caring about after, hence the TTL cache
and the lazy first build -- startup must not block on it, because the MCP server going
down takes the whole assistant with it.

Runnable on its own against a live instance:

    BIAB_API_BASE=http://localhost python step_search.py "species distribution"
"""

import asyncio
import os
import sys

import bm25

# Names are the strongest signal and the shortest field, so they lose to a long
# description on term frequency alone unless repeated. Same trick, and the same reason,
# as HEADING_WEIGHT in docs_search.
NAME_WEIGHT = 3

DEFAULT_MAX_RESULTS = 8
SUMMARY_CHARS = 160
# How long a built index is trusted. pipeline-repo is a bind mount that people edit
# under a running server, so this cannot be forever; rebuilding costs ~99 requests, so
# it cannot be short either.
CACHE_TTL_SECONDS = 600
# script-server walks the repository on every /info, and there are 99 of them. Enough
# concurrency to make the build quick, not enough to be the reason a run is slow.
FETCH_CONCURRENCY = 8

STEP_TYPES = ("pipeline", "script")


class Step:
    __slots__ = ("type", "path", "name", "summary", "description", "deprecated")

    def __init__(self, type, path, name, description, deprecated):
        self.type = type
        self.path = path
        self.name = name
        self.description = description or ""
        self.summary = _one_line(self.description)
        self.deprecated = deprecated

    def as_line(self):
        line = f"- {self.name} ({self.type}) — path: {self.path}"
        if self.summary:
            line += f"\n  {self.summary}"
        return line


def _one_line(description):
    """The first line of a description that says something.

    Pipeline descriptions are markdown documents that open with `## Introduction`, so
    both the first line and the first non-empty line are headings -- taking either one
    summarises half the catalogue as "Introduction". Headings are skipped outright and
    the first line of actual prose is used. Scripts are usually one sentence already.
    """
    for line in (description or "").split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if len(line) > SUMMARY_CHARS:
            line = line[:SUMMARY_CHARS].rsplit(" ", 1)[0] + "…"
        return line
    return ""


def _is_deprecated(info, name):
    """Whether to keep this step out of results.

    `lifecycle.status` is the structured signal and is what the UI reads. The substring
    check is a backstop for the steps that say it in their name or description without
    declaring a lifecycle, which is all the standing instructions used to have to go on
    and still catches a few.
    """
    lifecycle = info.get("lifecycle")
    if isinstance(lifecycle, dict) and str(lifecycle.get("status", "")).lower() == "deprecated":
        return True
    return "deprecated" in f"{name} {info.get('description') or ''}".lower()


class StepIndex:
    """The scripts and pipelines on this instance, searchable. Empty is non-fatal."""

    def __init__(self, steps):
        self.steps = list(steps)
        self.index = bm25.Bm25Index()
        for step in self.steps:
            tokens = (
                bm25.tokenize(step.name) * NAME_WEIGHT
                + bm25.tokenize(step.path.replace(">", " "))
                + bm25.tokenize(step.description)
            )
            self.index.add(step, tokens)
        self.index.finalize()

    def __len__(self):
        return len(self.steps)

    def catalogue(self, type="pipeline"):
        """Every step of one type, by name and path only.

        For "what can this instance do?", where the answer is the list itself. Summaries
        are left out on purpose: 28 pipelines with a sentence each is most of a context
        window, and the follow-up question is always about one of them.
        """
        listed = [s for s in self.steps if s.type == type and not s.deprecated]
        if not listed:
            return f"No {type}s are installed on this instance."
        lines = [f"- {s.name} — path: {s.path}" for s in sorted(listed, key=lambda s: s.name)]
        return (
            f"The {len(lines)} {type}s on this instance:\n"
            + "\n".join(lines)
            + f"\n\nCall `get_info` with type `{type}` and one of these paths for its inputs."
        )

    def search(self, query, type=None, max_results=DEFAULT_MAX_RESULTS):
        """Ranked steps as text ready to hand to a model, or a plain explanation."""
        if not self.steps:
            return (
                "The list of scripts and pipelines could not be read from this instance, "
                "so there is nothing to search. Say so rather than naming a pipeline "
                "from memory -- what is installed differs between instances."
            )

        query_tokens = bm25.tokenize(query or "")
        if not query_tokens:
            return self.catalogue(type or "pipeline")

        matches = []
        for _, step in self.index.rank(query_tokens):
            if step.deprecated or (type and step.type != type):
                continue
            matches.append(step)
            if len(matches) == max_results:
                break

        if not matches:
            return (
                f"No script or pipeline on this instance matches {query!r}. Try the "
                "words the platform itself would use, or ask for the full list. Do not "
                "name a pipeline that did not come back from this tool."
            )

        return (
            f"{len(matches)} of this instance's steps match {query!r}, most relevant "
            "first.\n\n"
            + "\n".join(step.as_line() for step in matches)
            + "\n\nThese paths are what `get_info` and `run_step` take. Read a step's "
            "`get_info` before deciding it is the right one."
        )


async def _fetch_type(client, type, semaphore):
    """Every step of one type, with its metadata. Partial results beat none."""
    listing = await client.get(f"/{type}/list", timeout=30)
    listing.raise_for_status()
    names = listing.json() or {}

    async def one(path, listed_name):
        async with semaphore:
            try:
                response = await client.get(f"/{type}/{path}/info", timeout=30)
                response.raise_for_status()
                info = response.json() or {}
            except Exception as exc:
                # A step whose description does not parse still exists and can still be
                # the answer; it just ranks on its name alone.
                print(f"[steps] no info for {type} {path!r}: {exc}", file=sys.stderr)
                info = {}
        name = info.get("name") or listed_name or path
        return Step(type, path, name, info.get("description"), _is_deprecated(info, name))

    return await asyncio.gather(*(one(path, name) for path, name in names.items()))


async def build_index(client):
    """Both types, fetched concurrently. Raises only if neither listing can be read."""
    semaphore = asyncio.Semaphore(FETCH_CONCURRENCY)
    results = await asyncio.gather(
        *(_fetch_type(client, type, semaphore) for type in STEP_TYPES),
        return_exceptions=True,
    )

    steps, failures = [], []
    for type, result in zip(STEP_TYPES, results):
        if isinstance(result, BaseException):
            failures.append(f"{type} ({result})")
            print(f"[steps] could not list {type}s: {result}", file=sys.stderr)
        else:
            steps.extend(result)

    if failures and not steps:
        raise RuntimeError("could not list " + " or ".join(failures))
    print(f"[steps] indexed {len(steps)} scripts and pipelines", file=sys.stderr)
    return StepIndex(steps)


class CachedStepIndex:
    """Builds on first use, then serves from cache until the TTL expires.

    Deliberately not built at import: server.py runs at container start, and 99 requests
    to a script-server that may not be up yet is a slow boot at best and a dead MCP
    server -- and so a dead assistant -- at worst.
    """

    def __init__(self, client, ttl=CACHE_TTL_SECONDS):
        self._client = client
        self._ttl = ttl
        self._index = None
        self._built_at = 0.0
        self._lock = asyncio.Lock()

    async def get(self):
        loop = asyncio.get_running_loop()
        async with self._lock:
            if self._index is None or loop.time() - self._built_at > self._ttl:
                try:
                    self._index = await build_index(self._client)
                    self._built_at = loop.time()
                except Exception as exc:
                    print(f"[steps] index build failed: {exc}", file=sys.stderr)
                    # An expired index is worth more than no index: the catalogue changes
                    # rarely, and the alternative is the model inventing a pipeline name.
                    if self._index is None:
                        self._index = StepIndex([])
            return self._index


if __name__ == "__main__":
    import httpx

    async def main():
        base = os.getenv("BIAB_API_BASE", "http://biab-gateway")
        async with httpx.AsyncClient(base_url=base) as client:
            index = await build_index(client)
            print(index.search(" ".join(sys.argv[1:])))

    asyncio.run(main())
