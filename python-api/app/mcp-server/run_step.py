"""Launching a run, shaped for a model instead of for HTTP.

The generated `run` tool is a faithful rendering of POST /{type}/{descriptionPath}/run
and an unusable one. Its request body is declared `text/plain` with `type: string`
(`run_input_body` in the OpenAPI spec), so:

- the body parameter's type says "string" while its example shows a JSON object, and a
  model that believes either one is half wrong;
- the body is not required, so calling `run` with no inputs at all is a legal call that
  starts a pipeline with nothing in it;
- "Content of input.json for this run" is the entire documentation, which means nothing
  to a caller that has never seen an input.json.

None of that says the thing a caller actually has to know: the keys are not the input
names from the script, they are `{step id}|{input name}` as returned by `getInfo` on the
pipeline (`data>loadFromStac.yml@56|t0`), plus bare `pipeline@NN` keys for the pipeline's
own selector inputs. A model reasons its way correctly to "call run", then has to invent
that key format, and that is where the thread is lost.

So this takes `inputs` as a real object, checks the keys against the step's own
description before anything is launched, and answers a wrong key with the list of the
right ones -- the contract arrives at the moment it is needed rather than in a prompt
written long before. Unspecified inputs are filled from the description's examples, the
same defaults the web form starts from.
"""

import json

# Both are what the UI builds: see RunHistory.jsx for the form link and
# PipelineResults.jsx for the viewer link. Paths only -- this server has no reliable way
# to know the public origin, which differs per session in the hosted deployment.
FORM_PATH = "/{step_type}-form/{step_path}/{run_hash}"
VIEWER_PATH = "/viewer/{run_id}"

MAX_LISTED_INPUTS = 40

# Input types the UI fills with a purpose-built selector, and which therefore arrive as
# structured objects rather than scalars -- see selectors.qmd. Pipelines routinely
# declare no example for them (BII's `pipeline@67`, its country and CRS, has example
# null), so a caller working from the description alone has nothing to copy and has to
# invent the object's shape. Worth naming explicitly when one is about to be sent empty.
SELECTOR_TYPES = {"country", "countryRegion", "countryRegionCRS", "CRS", "bboxCRS"}


def _describe_input(key, spec):
    """One line telling a caller what may go in this input."""
    parts = [f"- `{key}`"]
    kind = spec.get("type")
    if kind:
        parts.append(f"({kind})")
    label = spec.get("label")
    if label:
        parts.append(str(label))
    options = spec.get("options")
    if options:
        parts.append("one of " + ", ".join(json.dumps(o) for o in options))
    if "example" in spec:
        parts.append(f"example {json.dumps(spec.get('example'))}")
    return " ".join(parts)


def _input_contract(declared):
    listed = list(declared.items())[:MAX_LISTED_INPUTS]
    lines = [_describe_input(key, spec if isinstance(spec, dict) else {}) for key, spec in listed]
    if len(declared) > len(listed):
        lines.append(f"… and {len(declared) - len(listed)} more.")
    return "\n".join(lines)


def prepare(declared, inputs):
    """(body, notes) for a run, or raise ValueError naming the keys that are wrong.

    `declared` is the `inputs` block of the step's description; `inputs` is what the
    caller supplied. Returns the full body to post and a list of human-readable notes
    about what was defaulted.
    """
    supplied = dict(inputs or {})

    unknown = [key for key in supplied if key not in declared]
    if unknown:
        raise ValueError(
            "These input keys do not exist on this step: "
            + ", ".join(f"`{key}`" for key in unknown)
            + ".\nInput keys are `{step id}|{input name}`, not the bare input name.\n"
            "The inputs this step accepts are:\n"
            + _input_contract(declared)
        )

    body, defaulted, blank, selectors = {}, [], [], []
    for key, spec in declared.items():
        if key in supplied:
            body[key] = supplied[key]
            continue
        spec = spec if isinstance(spec, dict) else {}
        example = spec.get("example")
        body[key] = example
        if example is not None:
            defaulted.append(key)
        elif spec.get("type") in SELECTOR_TYPES:
            selectors.append((key, spec.get("type")))
        else:
            blank.append(key)

    notes = []
    if defaulted:
        # Counted, never listed. Naming the keys here is what turns a note that means
        # "this is fine" into an item to go and fix: a caller handed
        # `zonal_statistics>zonal_stats.yml@25|summary_statistic` reads back through the
        # description for its example, finds the value already sitting in the run, and
        # spends a whole round re-launching the run it has just started. The three notes
        # arrive in one sentence and in one register, so this is the only place to draw
        # the line between the one that needs nothing and the two that do.
        notes.append(
            f"{len(defaulted)} input(s) took the step's own example value. That is "
            "normal and needs no action; it is worth saying which of the user's own "
            "choices you set, not worth correcting."
        )
    if blank:
        notes.append(
            f"{len(blank)} input(s) sent empty because the step declares no example: "
            + ", ".join(f"`{k}`" for k in blank)
            + ". If the run fails, these are the first thing to check."
        )
    if selectors:
        notes.append(
            "SENT EMPTY, and these decide what the run is actually about: "
            + ", ".join(f"`{key}` ({kind})" for key, kind in selectors)
            + ". A run with these empty is very unlikely to be the one the user asked "
            "for. They take an object, not a name -- `search_documentation` for "
            "\"selectors\" gives the shape, and `get_run_report` on an earlier run of "
            "this pipeline gives a filled-in one to copy. Say so rather than "
            "presenting the run as if it matched the request."
        )
    return body, notes


def launch_summary(step_type, run_id, notes):
    """What to tell the caller once the engine has accepted the run.

    Notes first, run id and links last. What a caller acts on is what it read last, and
    a note in that position becomes the outstanding item: it goes back to `run_step` for
    another round instead of writing the answer, and on a small model with a per-round
    token budget that round is the one the answer needed. Ending on the links puts the
    thing to be reported where the run id used to have a note sitting after it.

    The rule against relaunching lives in api-guide.md too, but that is read once at the
    top of a conversation and this is read at the only moment it is ever tempting to
    break -- the same argument as the input keys in this file's opening.
    """
    step_path, _, run_hash = run_id.rpartition(">")
    lines = []
    if notes:
        lines.append("Inputs: " + " ".join(notes))
    lines += [
        "The run has STARTED. It is not finished -- do not wait for it and do not "
        "check on it; the user follows it in the interface. It is also already "
        "launched: do NOT call `run_step` again for this request, whatever the input "
        "notes above say. Anything above worth correcting is worth telling the user "
        "about, and is not a reason to start the pipeline a second time.",
        f"runId: {run_id}",
        "Form (relative to this instance's address): "
        + FORM_PATH.format(step_type=step_type, step_path=step_path, run_hash=run_hash),
        "Viewer (relative to this instance's address): "
        + VIEWER_PATH.format(run_id=run_id),
        "Give the user the runId and these links now, then stop.",
    ]
    return "\n".join(lines)
