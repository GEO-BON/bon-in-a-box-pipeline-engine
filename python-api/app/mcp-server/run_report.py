"""What happened in a run, read from the run's own files.

The engine records everything needed to diagnose and correct a failed run, but none of
it is in the OpenAPI spec, so the assistant had no tool for any of it. It could see
from the history that a run failed and could not see why -- which meant that when it
filled an input in wrongly, the run died and there was no way back to a corrected one.

Everything here comes off the filesystem. python-api already mounts the engine's output
folder read-only at /output (see the python-api volumes in compose.yml), so this needs
no new mount, no HTTP call and no new endpoint on script-server.

The layout, for a run id like `BII>BIIChange>7f3a…` (script-server writes '>' where the
filesystem has '/', see FILE_SEPARATOR in Routing.kt):

    /output/BII/BIIChange/7f3a…/input.json           the inputs the run was given
    /output/BII/BIIChange/7f3a…/pipelineOutput.json  {step id: output folder}, written
                                                     only once the run has finished
    /output/<step folder>/output.json                that step's outputs, or {"error": …}
    /output/<step folder>/logs.txt                   that step's log

input.json is keyed `{step id}|{input name}` and is exactly the body `run` accepts, so
returning it verbatim gives the assistant something it can edit one key of and re-run.
"""

import json
import os
from pathlib import Path

OUTPUT_ROOT = Path(os.getenv("OUTPUT_ROOT", "/output"))

DEFAULT_LOG_LINES = 30
# Guards on how much of a run can land in a 16k context window. The inputs are the part
# worth spending on: they are what gets corrected and resubmitted.
MAX_INPUT_CHARS = 3000
MAX_REPORTED_STEPS = 5

# pullFinalOutputs() substitutes these for the output folder of a step that never ran.
NOT_A_FOLDER = {"skipped", "cancelled", "canceled", "aborted"}


def _run_folder(run_id):
    """The run's directory, or ValueError if the id points outside the output root."""
    relative = (run_id or "").strip().strip("/").replace(">", "/")
    if not relative:
        raise ValueError("no run id given")
    root = OUTPUT_ROOT.resolve()
    folder = (root / relative).resolve()
    # A run id arrives from a language model, so it is untrusted input to a path join.
    if folder != root and root not in folder.parents:
        raise ValueError(f"run id {run_id!r} resolves outside the output folder")
    return folder


def _read_json(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def _tail(path, max_lines):
    try:
        text = path.read_text(errors="replace")
    except OSError:
        return None
    rows = [row for row in text.splitlines() if row.strip()]
    if not rows:
        return None
    return "\n".join(rows[-max_lines:])


def _step_failure(step_id, folder_value, max_log_lines):
    """A block describing one step, or None if that step is fine and uninteresting."""
    if folder_value in NOT_A_FOLDER:
        return f"- {step_id}: {folder_value} (did not run)"

    if not isinstance(folder_value, str):
        return f"- {step_id}: no output folder recorded"

    try:
        folder = _run_folder(folder_value)
    except ValueError:
        return f"- {step_id}: unreadable output folder {folder_value!r}"

    outputs = _read_json(folder / "output.json")
    error = outputs.get("error") if isinstance(outputs, dict) else None
    if not error:
        return None

    block = [f"- {step_id} FAILED: {error}"]
    log = _tail(folder / "logs.txt", max_log_lines)
    if log:
        block.append(f"  last {max_log_lines} log lines:\n{log}")
    return "\n".join(block)


def report(run_id, max_log_lines=DEFAULT_LOG_LINES):
    """A text report on one run: its inputs, whether it failed, and why."""
    folder = _run_folder(run_id)
    if not folder.is_dir():
        return (
            f"No run {run_id!r} on this server. Run ids look like "
            "`BII>BIIChange>7f3a…`; check `getHistory` for the ones that exist."
        )

    sections = [f"# Run {run_id}"]

    inputs = _read_json(folder / "input.json")
    if inputs is None:
        sections.append("Inputs: not recorded for this run.")
    else:
        rendered = json.dumps(inputs, indent=2)
        if len(rendered) > MAX_INPUT_CHARS:
            rendered = rendered[:MAX_INPUT_CHARS] + "\n… (truncated)"
        sections.append(
            "## Inputs this run was given\n"
            "This is exactly the body `run` takes. To correct the run, change the "
            "offending value here and submit the whole object again.\n"
            f"```json\n{rendered}\n```"
        )

    pipeline_output = _read_json(folder / "pipelineOutput.json")
    if pipeline_output is None:
        # Written only after every step has settled, so its absence is the signal that
        # the run has not finished rather than that anything is wrong.
        sections.append(
            "## Status\nStill running, or stopped before it could finish. No results "
            "have been recorded yet. Do not re-run it: wait, and let the user watch it "
            "in the interface."
        )
        return "\n\n".join(sections)

    error = pipeline_output.get("error")
    steps = {k: v for k, v in pipeline_output.items() if k != "error"}

    failures = []
    for step_id, folder_value in steps.items():
        block = _step_failure(step_id, folder_value, max_log_lines)
        if block:
            failures.append(block)

    if error:
        sections.append(f"## Status\nFAILED: {error}")
    elif failures:
        sections.append("## Status\nFAILED in one or more steps.")
    else:
        sections.append(
            "## Status\nCompleted. Step outputs:\n"
            + "\n".join(f"- {k}: {v}" for k, v in sorted(steps.items()))
        )

    if failures:
        shown = failures[:MAX_REPORTED_STEPS]
        sections.append("## Steps that did not produce output\n" + "\n".join(shown))
        if len(failures) > len(shown):
            sections.append(f"({len(failures) - len(shown)} further step(s) not shown.)")
        sections.append(
            "The message above is usually about one input. Say which input was wrong "
            "and what it should be, then ask the user to confirm before running again."
        )

    return "\n\n".join(sections)
