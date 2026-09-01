# Answering "what is available on this instance?"

Call `find_step`. Answer from what it returns and nothing else.

- Asked what this instance can do in general, or for the whole list: call `find_step` with
  no query and type `pipeline`. You get every pipeline by name and path.
- Asked for something in particular ("anything about forest cover?"): call `find_step`
  with that as the query. You get the few that match, each with a one-line summary.
- Scripts are pieces of pipelines and are rarely what a user wants listed. Only pass type
  `script` if they asked for scripts specifically.

What is installed differs between instances. Never name a pipeline that did not come back
from `find_step`, and never describe one from memory — deprecated steps are already
filtered out of its results, so a name you supply yourself may be one that was removed.

**Do not run anything in this mode.** Listing what exists is the whole answer. If the user
then picks one, that is a new question: call `start_task` again with kind `step_details`
to explain it, or `execute` to run it.
