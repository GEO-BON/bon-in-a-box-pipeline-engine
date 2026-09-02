# Running a pipeline

Five steps, in this order. Do not improvise around them.

**1. Find it.** `find_step` with what the user asked for, to get the pipeline's path.
Prefer pipelines: scripts are pieces of one and usually need inputs produced by an earlier
step. If several match, ask which one rather than picking.

**2. Read its inputs.** `get_info` on that path. Its `inputs` block is BOTH the
documentation and the exact key names step 4 takes. Read it before deciding any value.
Keys are `{step id}|{input name}` exactly as returned — `data>loadFromStac.yml@56|t0`,
never a bare `t0` — plus bare `pipeline@NN` keys for the pipeline's own inputs.

**3. Fill in the place.** If any input has type `bboxCRS`, `country`, `countryRegion`,
`countryRegionCRS` or `CRS`, it takes an OBJECT, not a country name — and pipelines
routinely declare no example for it. That input is what decides which country or region
the analysis is about.

Call `getCountryRegionBbox` with `output_format=chooser_input` and use what it returns,
unchanged, as the value for that key. One call per selector input.

- `id` is a code, not a name. For a country, pass the ISO3 directly — Colombia is `COL`,
  Canada is `CAN`. You know these; use them.
- For a subnational region, call `getRegionsList` for that country first and take the
  `adm1_src` of the region you want.
- Only call `getCountriesList` if you genuinely cannot recall an ISO3 code. It returns
  every country on Earth and will crowd out the rest of the conversation.

Never leave one of these empty and then describe the run as being about the place the user
asked for. If the code does not resolve, ask the user which place they meant.

**4. Launch it.** `run_step` with the path and those keys, as an object. Set only the
inputs the user's request actually determines; everything else is filled from the step's
own examples, which is what the web form does too. If a key is wrong, `run_step` refuses
and lists the real keys — use that list, do not guess again.

**5. Report and stop.** `run_step` returns as soon as the engine accepts the run. It
returns the run id and two links, relative to this instance's address. Give the user the
run id and both links, say the run is in progress, and stop.

## The three rules that matter

**Never launch twice.** Receiving a run id means the pipeline is running. Never call
`run_step` a second time for the same request, whatever else goes wrong afterwards — not
to correct an input, not because a note in the result looked like something to fix. The
inputs decide the run id, so an identical re-run just returns the same result anyway.

**Never poll.** A pipeline takes minutes to hours. You cannot wait for it and you are not
expected to. Do not call `getHistory` to watch it finish; the user watches it in the
interface. Answer their next message when it comes.

**Never retry an error.** If a tool call fails, say plainly what failed and stop. Do not
call it again with the same arguments, and do not keep rewriting an answer you have
already given. One clear reply, even one reporting a failure, is worth more than several
attempts at a better one.
