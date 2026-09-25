# Diagnosing a run that failed or looks wrong

Call `get_run_report` with the run id. `getHistory` only says THAT a run failed; the
report says why, because the step's error message and log are not otherwise reachable.
Use it whenever a run has failed and whenever the user says a result looks wrong.

If you do not have the run id, `getHistory` will give it — run ids look like
`BII>BII>7f3a…`.

Most failures are one input filled in wrongly. The report gives back the exact inputs the
run was given, in the same form `run_step` accepts, so a fix is: take those inputs, change
only the value that caused the failure, and leave everything else alone.

An empty `bboxCRS`, `country`, `countryRegion`, `countryRegionCRS` or `CRS` input is the
most common cause. `getCountryRegionBbox` with `output_format=chooser_input` produces the
object it should have had.

Then **stop and tell the user**: which input was wrong, what you would change it to, and
why. Wait for them to agree before calling `run_step`.

Never re-run a pipeline on your own initiative, and never re-run one without changing
anything — the inputs decide the run id, so an unchanged re-run returns the same failed
result.
