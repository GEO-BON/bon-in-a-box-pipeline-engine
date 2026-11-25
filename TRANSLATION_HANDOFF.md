# Translation handoff

## Goal and agreed scope

Continue making BON in a Box translatable with Weblate, starting with the React
application in `ui/`. The source language is English and the first target is
French. The user speaks French and can review or help with wording; ask when
terminology, behavior, or scope needs clarification.

The backend and API-provided content are to be translated later. Do not
translate API responses, names, descriptions, status identifiers, error
details, units, or other backend data by guessing in the React app. UI-owned
labels for those values may be translated. Plan the backend approach separately
with the user before changing API contracts or how language is passed to the
server.

The Weblate server will be self-hosted separately and shared across applications.
Translations require review before release. It has not yet been connected or
its review/export workflow verified, as far as this work established.

## Current state

As of 2026-11-25, branch `translation`, the foundation and pilot are in place:
i18next/react-i18next, English and French catalogs, browser language detection,
English fallback, and a selector in the user menu. An explicit selection is
stored in localStorage under `biab.ui.language`; without one, the browser
language is followed. The selector shows the detected language's flag rather
than a separate “use browser language” choice. Language metadata, fallback and
flags are centralized in `ui/src/languages.js`.

The main journeys have been migrated: navigation, home and startup, pipeline
and script selection, forms and choosers, results, history, file selection,
lifecycle labels and captcha. This is not a claim that every UI string has been
translated. In particular, the pipeline editor still has English UI strings
such as `Pipeline output` in `ui/src/components/PipelineEditor/StepChooser.jsx`;
`ui/src/components/info/InfoPage.jsx` also has English UI text. Inventory chat
controls, remaining dialogs, and third-party components as well. Some API error
wrappers in info/editor pages were translated without translating their entire
pages.

French wording is a draft and still needs in-context review by the user. Some
API values, such as a CRS unit of `degree`, remain in English intentionally
until the backend is translated.

Recent fixes include:

- The chooser's missing `useTranslation()` hook was fixed after a runtime
  `ReferenceError`. Each component using `t` needs its own hook or an explicitly
  passed translation function.
- `text` and `text[]` input types now use the translated `text` name/plural;
  MIME types are formatted as file paths without searching translated text for
  the English word `path`.
- The compute description and optional HPC sentence use separate translation
  keys. Preserve the singular/plural forms of the compute sentence.

## Next steps

1. Inspect the current branch and worktree before editing. Confirm with the user
   whether to finish the remaining UI first or begin planning the backend.
2. Inventory and translate the remaining **UI-owned** strings, especially
   `ui/src/components/PipelineEditor/`, `ui/src/components/info/`, chat,
   dialogs and any missed routes. Inventory third-party strings (for example
   `@svar-ui` file manager and editor/map controls) and determine their
   localization capabilities rather than modifying API data.
3. Finish browser verification in English and French: switch languages in the
   selector without reloading, reload to check persistence, and inspect forms,
   chooser, history, results and error states. The FileBrowser modal, history
   filter/no-match state, expanded result details and narrow-width/nav overlap
   were not confirmed in the earlier browser checks. Recheck them rather than
   assuming full coverage.
4. Review the French in context with the user; test interpolation, real
   plurals, missing-key fallback, accessibility and responsive layouts. Build
   the production UI and verify that the deployed build contains the catalogs.
5. Configure and exercise the separate Weblate component and confirm that
   unreviewed translations cannot reach releases. Then agree on and implement a
   backend localization plan, including language propagation and compatibility
   for API consumers.

Original delivery plan: (1) foundation/pilot, (2) main journeys, (3) remaining
UI and third-party inventory, (4) quality and release. Backend localization is
a subsequent, separately planned effort.

## Implementation conventions

- Catalogs: `ui/src/locales/en/translation.json` and
  `ui/src/locales/fr/translation.json`, i18next JSON v4. Keep key structure and
  `{{interpolation}}` placeholders synchronized. Use whole sentences and CLDR
  plural keys where appropriate; do not build sentences out of translated
  fragments. The optional HPC sentence is a separate complete sentence.
- Use `useTranslation()` within each React component that renders translated
  content; helpers may receive `t` or use the shared `ui/src/i18n.js` instance.
  Prefer storing data over pre-rendered JSX so language switches can re-render.
  Error messages stored as strings can remain snapshots in their original
  language; do not assume all existing error state updates live.
- Do not translate machine-readable identifiers; for example, history filters
  must retain API status values while their displayed labels are translated.
- French typography follows the OQLF rules tested by
  `ui/src/locales/fr.typography.test.js`: allow **no space or U+202F** before
  `?`, `!` and `;`; use U+00A0 before a colon, inside guillemets, and before
  dashes as applicable; use `’` and `…`. Consult the test for the full set.
  The OQLF reference is
  https://vitrinelinguistique.oqlf.gouv.qc.ca/22039/la-typographie/espacement/espacement-avant-et-apres-les-signes-de-ponctuation-et-les-symboles.
- `ui/scripts/fix_french_typography.py` can fix common issues in JSON and
  Markdown. From `ui/`, run
  `python3 scripts/fix_french_typography.py src/locales/fr/translation.json`;
  use `--check` to avoid writing. It is heuristic, so review the diff,
  especially Markdown and technical text. JSON keys and common code,
  placeholders and links are protected, but unusual syntax may need manual
  attention.
- Weblate component configuration is documented in `ui/README.md`: file mask
  `ui/src/locales/*/translation.json`, English monolingual base file, French
  target, i18next v4 and review enabled. Verify the actual review and release
  safeguards rather than assuming review mode enforces them.

## Tests and verification

- From `ui/`: `npm test` and `npm run build`. The UI workflow
  `.github/workflows/ui_tests.yml` uses Node 22, `npm ci`, both commands and
  `python3 -m unittest discover -s scripts -p 'test_*.py'`.
- `ui/src/i18n.test.jsx` covers selection, catalogs, interpolation and
  translated UI behavior. `ui/src/components/RunHistory.i18n.test.jsx` tests
  language switching without refetching API content. The typography test
  reports the fixer command when a rule fails.
- The last focused verification on 2026-11-25 passed 5 Python fixer tests and
  14 French typography tests. A deliberately broken catalog in an isolated
  copy confirmed that a failing test displays the fixer command. Earlier,
  the full UI suite and production build passed, but rerun them on the current
  checkout before claiming release readiness.
- In the earlier development environment, npm commands were run inside the
  `biab-ui` container with `ui/` mounted at `/app`. On another computer use
  the available development environment and project instructions; do not
  assume that container exists or is running.

## Transfer

This handoff is a repository file. Make sure it and any other required changes
are committed/pushed or otherwise transferred to the other computer; creating
the file alone does not transfer it. Do not include credentials or local
browser/session state.

Remove file after use by next agent.