"""Keyword retrieval over the BON in a Box documentation, for the assistant.

The corpus is `search.json` -- the index Quarto already emits so the docs site's own
search box works. It is one entry per heading, already plain text with the HTML
stripped, which is why this module needs no dependencies, no embedding model and no
vector store: the chunking nobody wants to write by hand is a build artifact of the
docs we already publish.

Two things it does on top of that:

- Splits long sections into passages. "Step 3: Create a YAML file" is 15k characters,
  about as much as the chat model's whole context window (see ui/src/components/chat,
  num_ctx 16384). Returning it whole would be useless, and truncating it from the top
  would return the wrong part -- the input type table sits near the end. So sections
  are scored and returned by passage.

- Scores with BM25 rather than term counts, because that same size spread would
  otherwise let the two 15k sections win every query on length alone.

Kept out of server.py so that file stays about the OpenAPI toolset, and so this can be
exercised without standing up an MCP server:

    python docs_search.py "what does bboxCRS mean"
"""

import html
import json
import math
import os
import re
import sys
from collections import Counter

# Where the docs are published. Results cite it so the user can open the full page --
# the assistant only ever sees the excerpt.
DOCS_BASE_URL = os.getenv(
    "DOCS_BASE_URL", "https://geo-bon.github.io/bon-in-a-box-pipeline-engine/"
).rstrip("/")

# Baked into the image by the build and bind-mounted in development, the same way the
# OpenAPI spec is -- see the comment on SPEC_PATHS in server.py for why a file staged
# into the image beats fetching one at startup here. Nothing falls back to HTTP: the
# per-session Kubernetes deployment has no route to the docs site, and an assistant
# that loses doc search is a smaller failure than one that hangs on boot.
INDEX_PATHS = [
    os.getenv("DOCS_SEARCH_INDEX_PATH", ""),
    "/app/mcp-server/docs-search.json",
    os.path.join(os.path.dirname(__file__), "docs-search.json"),
]

PASSAGE_TARGET_CHARS = 1200
# Heading tokens are repeated rather than scored as a separate field: it is the same
# thing BM25F would do, in one line, and passages are long enough that the effect on
# length normalisation is noise.
HEADING_WEIGHT = 3
DEFAULT_MAX_RESULTS = 3
# Long sections otherwise take every slot: "how do I read inputs in my R script" filled
# all three with consecutive passages of "Step 4". Two from one section is enough to
# establish it, and the third slot is better spent on a section that disagrees.
MAX_PER_SECTION = 2
# Roughly 1.5k tokens. The chat model has 16k of context to hold the system prompt, the
# conversation, and every other tool result in the turn; this is as much as doc search
# can fairly claim of it.
DEFAULT_CHAR_BUDGET = 6000

K1 = 1.5
B = 0.75

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# BM25 down-weights common words by how many documents contain them, which is enough
# on a normal corpus and is not enough here: across 93 short passages, "what" and "i"
# score a *higher* inverse document frequency than "bboxCRS". A natural question then
# ranks on its question words -- "what does bboxCRS mean" returned the peer review
# instructions -- so the function words come out before scoring rather than after.
#
# Deliberately absent: "mean", which in this domain is an aggregation method, and
# "type", "input", "run" and "file", which are the platform's own vocabulary.
_STOPWORDS = frozenset(
    """
    a about all also am an and any are as at be because been but by can could did do
    does doing done for from get give had has have he her here how i if in into is it
    its just me might more most my need no not of on one or other our out over please
    said same see shall she should so some such than that the their them then there
    these they this those to too us very want was way we were what when where which
    while who why will with would you your
    """.split()
)


def _tokenize(text):
    """Lowercase alphanumeric runs, minus stopwords, crudely singularised.

    The depluralisation is wrong as often as it is right ("selectors" -> "selector"
    but "process" -> "proces"), which does not matter: it is applied to the query and
    the corpus alike, so both sides land on the same wrong stem and still match.
    """
    tokens = []
    for token in _TOKEN_RE.findall(text.lower()):
        if token in _STOPWORDS:
            continue
        if len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
            token = token[:-1]
        tokens.append(token)
    return tokens


def _split_passages(text):
    """A section's text as passages of roughly PASSAGE_TARGET_CHARS.

    Quarto emits one line per source paragraph, and per table cell -- the input type
    table in "Step 3" arrives as a column of bare type names with their descriptions on
    neighbouring lines. Grouping whole lines up to a size budget is what keeps those
    fragments next to each other; splitting on a character count would not.
    """
    lines = [line.strip() for line in text.split("\n")]
    lines = [line for line in lines if line]

    passages, current, size = [], [], 0
    for line in lines:
        if current and size + len(line) > PASSAGE_TARGET_CHARS:
            passages.append("\n".join(current))
            # Carry the last line over: a table cell's meaning is usually in the line
            # above it, and a cut between the two loses both.
            current, size = [current[-1]], len(current[-1])
        current.append(line)
        size += len(line) + 1
    if current:
        passages.append("\n".join(current))
    return passages


def _unique_sections(entries):
    """(entry, text) pairs, one per distinct section body.

    Quarto repeats a page's opening section as a second, page-level entry with no
    anchor in its href. Anchored entries are visited first so the duplicate that
    survives is the one that deep-links to the heading.
    """
    seen = set()
    for entry in sorted(entries, key=lambda e: "#" not in (e.get("href") or "")):
        # Quarto stores the text HTML-escaped, so every code sample in it arrives with
        # its operators mangled -- R's assignment reads "input &lt;- biab_inputs()".
        # The model is being shown these excerpts as documentation; hand it the code
        # the docs actually print.
        text = html.unescape(entry.get("text") or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        yield entry, text


class _Passage:
    __slots__ = ("heading", "url", "text", "freqs", "length")

    def __init__(self, heading, url, text, tokens):
        self.heading = heading
        self.url = url
        self.text = text
        self.freqs = Counter(tokens)
        self.length = len(tokens)


class DocsIndex:
    """A searchable view of the Quarto index. Empty is a valid, non-fatal state."""

    def __init__(self, entries):
        self.passages = []
        for entry, text in _unique_sections(entries):
            title = (entry.get("title") or "").strip()
            section = (entry.get("section") or "").strip()
            heading = " > ".join(part for part in (title, section) if part)
            href = (entry.get("href") or "").lstrip("/")
            url = f"{DOCS_BASE_URL}/{href}" if href else DOCS_BASE_URL
            heading_tokens = _tokenize(heading) * HEADING_WEIGHT
            for passage in _split_passages(text):
                self.passages.append(
                    _Passage(heading, url, passage, heading_tokens + _tokenize(passage))
                )

        self.avg_length = (
            sum(p.length for p in self.passages) / len(self.passages)
            if self.passages
            else 0.0
        )

        doc_freq = Counter()
        for passage in self.passages:
            doc_freq.update(passage.freqs.keys())
        total = len(self.passages)
        # Floored at zero: with a corpus this small, a term in more than half the
        # passages ("the", "pipeline") gets a negative weight from the textbook
        # formula, which would actively penalise passages for containing it.
        self.idf = {
            term: max(0.0, math.log(1 + (total - n + 0.5) / (n + 0.5)))
            for term, n in doc_freq.items()
        }

    def __len__(self):
        return len(self.passages)

    def _score(self, passage, query_tokens):
        score = 0.0
        for term in query_tokens:
            freq = passage.freqs.get(term)
            if not freq:
                continue
            norm = 1 - B + B * (passage.length / self.avg_length)
            score += self.idf.get(term, 0.0) * (freq * (K1 + 1)) / (freq + K1 * norm)
        return score

    def search(self, query, max_results=DEFAULT_MAX_RESULTS, char_budget=DEFAULT_CHAR_BUDGET):
        """Ranked passages as text ready to hand to a model, or a plain explanation."""
        if not self.passages:
            return (
                "The documentation index is not available on this server, so the "
                "documentation cannot be searched. Answer from the API and from the "
                "step's own input descriptions instead, and mention that the "
                "documentation is at " + DOCS_BASE_URL + "/ ."
            )

        query_tokens = _tokenize(query or "")
        if not query_tokens:
            return (
                "That query has no searchable terms in it -- it is all common words. "
                "Search again for the thing you actually want to know about, such as "
                "an input type name or a feature of the platform."
            )

        scored = [(self._score(p, query_tokens), p) for p in self.passages]
        scored = [pair for pair in scored if pair[0] > 0]
        if not scored:
            return (
                f"Nothing in the BON in a Box documentation matches {query!r}. The "
                "documentation covers using the platform, writing scripts and "
                "pipelines, input and output types, and installation -- it does not "
                "describe individual scripts, whose inputs are documented by their "
                "own metadata."
            )
        scored.sort(key=lambda pair: pair[0], reverse=True)

        selected, per_section = [], Counter()
        for _, passage in scored:
            if per_section[passage.url] >= MAX_PER_SECTION:
                continue
            per_section[passage.url] += 1
            selected.append(passage)
            if len(selected) == max_results:
                break

        blocks, used = [], 0
        for passage in selected:
            text = passage.text
            remaining = char_budget - used
            if len(text) > remaining:
                if not blocks:
                    # Never return nothing because the top hit alone is oversized.
                    text = text[:remaining].rsplit("\n", 1)[0] + "\n[…truncated]"
                else:
                    break
            used += len(text)
            blocks.append(f"## {passage.heading}\nSource: {passage.url}\n\n{text}")

        return (
            f"{len(blocks)} passage(s) from the BON in a Box documentation, most "
            f"relevant first.\n\n" + "\n\n---\n\n".join(blocks)
        )


def _load_entries():
    for path in INDEX_PATHS:
        if not path or not os.path.exists(path):
            continue
        try:
            with open(path) as handle:
                entries = json.load(handle)
        except (OSError, ValueError) as exc:
            print(f"[docs] {path} is not readable JSON ({exc}); ignoring it", file=sys.stderr)
            continue
        if isinstance(entries, list) and entries:
            print(f"[docs] loaded documentation index from {path}", file=sys.stderr)
            return entries
        print(f"[docs] {path} is not a non-empty list; ignoring it", file=sys.stderr)

    print(
        "[docs] no documentation index found -- search_documentation will say so when "
        "called. Stage docs/search.json to /app/mcp-server/docs-search.json, or set "
        "DOCS_SEARCH_INDEX_PATH.",
        file=sys.stderr,
    )
    return []


def load_index():
    return DocsIndex(_load_entries())


if __name__ == "__main__":
    index = load_index()
    print(f"[docs] {len(index)} passages indexed", file=sys.stderr)
    print(index.search(" ".join(sys.argv[1:]) or "input types"))
