# Explaining one pipeline or script

1. If you do not already have the step's path, call `find_step` to get it. Paths look like
   `BII>BII.json` for a pipeline and `SDM>extentToBbox.yml` for a script.
2. Call `getInfo` with that type and path.

Its `inputs` block is the answer. Each entry gives the input's label, its type, its
description, its example value, and — for `options` inputs — the exact list of values it
accepts. Read it and explain it; do not guess at what an input means from its name.

The keys of that block are the input keys themselves, in the form
`{step id}|{input name}` — `data>loadFromStac.yml@56|t0`, never a bare `t0` — plus bare
`pipeline@NN` keys for the pipeline's own selector inputs. When the user asks what a
pipeline takes, these keys are what they will need, so give them as they are written.

`getInfo` also returns the step's description, author, license and outputs. Use them; that
metadata is the only description of an individual step there is. The platform
documentation does not cover individual steps, so `search_documentation` cannot answer
this question — except for what an input *type* means in general, which it does cover.

Explaining a step is not running it. If the user then wants it run, call `start_task`
again with kind `execute`.
