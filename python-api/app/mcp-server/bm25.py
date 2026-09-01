"""BM25 scoring, shared by the two things the assistant searches.

Lifted out of docs_search.py unchanged when step_search.py needed the same ranking over
a different corpus. Everything here was tuned against the documentation index -- the
lowered `B`, the stopword list that deliberately keeps the platform's own vocabulary, the
IDF floor -- and the reasons are recorded at each one rather than in a commit message,
because every one of them was arrived at by watching a specific query return the wrong
passage.

The index is payload-agnostic: `add()` takes whatever object the caller wants back from
`rank()`, plus the tokens to score it on. docs_search hands it passages, step_search hands
it scripts and pipelines.
"""

import math
import re
from collections import Counter

K1 = 1.5
# Below BM25's usual 0.75. Passages are already cut to a target size, so the length
# spread this term exists to correct is mostly gone, and at 0.75 it was rewarding what
# remained of it -- the short leftover passage at the end of a section. "What does
# bboxCRS mean" ranked a trailing fragment above the paragraph that defines the term.
B = 0.5

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


def tokenize(text):
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


class _Document:
    __slots__ = ("payload", "freqs", "length")

    def __init__(self, payload, tokens):
        self.payload = payload
        self.freqs = Counter(tokens)
        self.length = len(tokens)


class Bm25Index:
    """Documents scored by BM25. Empty is a valid, non-fatal state.

    Build it by calling `add()` for each document and then `finalize()` once. Nothing
    stops you scoring before finalising; you would just get zeros, because the IDF table
    is what `finalize()` computes.
    """

    def __init__(self, k1=K1, b=B):
        self.k1 = k1
        self.b = b
        self.documents = []
        self.avg_length = 0.0
        self.idf = {}

    def add(self, payload, tokens):
        self.documents.append(_Document(payload, tokens))

    def finalize(self):
        self.avg_length = (
            sum(d.length for d in self.documents) / len(self.documents)
            if self.documents
            else 0.0
        )

        doc_freq = Counter()
        for document in self.documents:
            doc_freq.update(document.freqs.keys())
        total = len(self.documents)
        # Floored at zero: with a corpus this small, a term in more than half the
        # documents ("the", "pipeline") gets a negative weight from the textbook
        # formula, which would actively penalise documents for containing it.
        self.idf = {
            term: max(0.0, math.log(1 + (total - n + 0.5) / (n + 0.5)))
            for term, n in doc_freq.items()
        }
        return self

    def __len__(self):
        return len(self.documents)

    def _score(self, document, query_tokens):
        score = 0.0
        for term in query_tokens:
            freq = document.freqs.get(term)
            if not freq:
                continue
            norm = 1 - self.b + self.b * (document.length / self.avg_length)
            score += self.idf.get(term, 0.0) * (freq * (self.k1 + 1)) / (freq + self.k1 * norm)
        return score

    def rank(self, query_tokens):
        """(score, payload) for every document that matches at all, best first."""
        scored = [
            (self._score(document, query_tokens), document.payload)
            for document in self.documents
        ]
        scored = [pair for pair in scored if pair[0] > 0]
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return scored
