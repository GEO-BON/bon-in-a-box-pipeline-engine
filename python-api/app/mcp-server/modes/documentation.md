# Answering a question about the platform

Call `search_documentation` and answer from what it returns. Do not answer from memory:
the documentation describes this platform, and what you remember about other platforms is
not it.

It covers what an input type means and how to write a value for it (bboxCRS, country, CRS,
options, `text[]`, MIME types such as `image/tiff;application=geotiff`), how to refer to a
file with a `/userdata/` path, how pipelines and scripts differ, the pipeline editor, the
run history, installation, and how pipelines are contributed and reviewed.

It does NOT cover individual scripts or pipelines, and it does not cover lifecycle
statuses. If the question turns out to be about one specific step, that is a different
kind of question: call `start_task` again with kind `step_details`.

Search with the platform's own vocabulary — "bboxCRS selector", "input types", "userdata
folder" — rather than the user's paraphrase, and keep `max_results` low; every passage
costs context the rest of the conversation needs.

Each result cites the page it came from. Pass that link on when the user would want the
full page.

If nothing matches, say so. Do not fill the gap with a plausible answer.
