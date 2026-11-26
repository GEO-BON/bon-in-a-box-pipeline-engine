# React + Vite

## UI translation

The UI translates navigation, the home page, startup messages, the main user
journeys (pipeline/script selection, input forms, results, run history, and file
selection), the pipeline editor, information page, chat controls, and the STAC
asset chooser into English and French. Names, descriptions, statuses, raw errors,
and other content supplied by APIs are not translated by the UI.

Third-party localization has limits: React Flow's editor controls, minimap, and
connection-handle labels use its `ariaLabelConfig` localization API. The SVAR
file manager uses its `Locale` provider and a local adapter for French strings.
SVAR formats file sizes with fixed English unit abbreviations in the file list
and details. Review embedded third-party controls when upgrading dependencies.

The browser's preferred supported language is used by default, falling back to
English. The language selector in the user menu (a round flag of the current
language with a dropdown arrow) can override this; explicit choices are saved in
the `biab.ui.language` localStorage key for this site and browser. Until a choice
is made, nothing is saved and the language follows the browser. A storage error is
shown to the user; the selected language still works until the page is reloaded.

English source strings are in `src/locales/en/translation.json` and French
translations are in `src/locales/fr/translation.json`. Use stable, descriptive
keys, whole sentences, i18next interpolation, and CLDR plural forms. Do not
translate API data or machine-readable values. `Trans` can preserve React
components such as links in sentences; use a non-HTML placeholder name and
verify that the link retains its text.

SVAR strings are kept separately in `src/locales/en/file-manager.json` and
`src/locales/fr/file-manager.json`, in the i18next `fileManager` namespace. The
English catalog provides Weblate source text and fallback; SVAR's built-in
English remains in use when English is selected. The adapter maps stable
catalog keys to SVAR's exact keys and supplies French date settings. When
upgrading SVAR, review its locale keys and update both catalogs and the adapter.

### Weblate setup

The self-hosted Weblate instance is separate from this application. Create a
component for this repository with:

- Format: i18next JSON file v4
- File mask: `ui/src/locales/*/translation.json`
- Source language: English; monolingual base file: `ui/src/locales/en/translation.json`
- Target language: French (`fr`)
- Review enabled, with authorized reviewers and i18next interpolation checks.

Create a second component in the same project and Git repository for the file
manager, using the same format, languages, and review settings:

- File mask: `ui/src/locales/*/file-manager.json`
- Monolingual base file: `ui/src/locales/en/file-manager.json`

Use Weblate's linked-repository configuration to share the repository between
components, and verify commits, review and export settings for both.

Developers maintain English source strings; translators propose French text in
Weblate. Require linguistic approval before merging translation updates into
the deployment branch. Check the actual Weblate review, export and Git settings:
enabling review alone must not be assumed to exclude unreviewed translations.
Test a new translation and an English source change before using the workflow
for releases. JSON does not carry translator descriptions, so add context in
Weblate and maintain ecosystem terminology in its glossary.

The French catalog is an initial draft for review. Weblate has not been
connected or configured by the UI build. Translation updates are bundled by
Vite and deployed with the application; Weblate is not a runtime dependency.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Runs the Vitest suite once. For a focused run, use
`npm test -- src/i18n.test.jsx`.

### `npm run build`

Builds the app for production to the `dist` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

Language flags in `src/assets/flags/` are from
[circle-flags](https://github.com/HatScripts/circle-flags) (MIT). To add a
language, create both `src/locales/<code>/translation.json` and
`src/locales/<code>/file-manager.json`, add its SVG flag, add an entry to
`src/languages.js`, and add its file-manager locale settings.

`npm test` also checks the French catalog against the OQLF punctuation spacing rules
(`src/locales/fr.typography.test.js`). 
We could add similar tests for other languages.

To fix common French typography issues in a JSON or Markdown file, run from `ui/`:

```sh
python3 scripts/fix_french_typography.py src/locales/fr/translation.json
python3 scripts/fix_french_typography.py src/locales/fr/file-manager.json
python3 scripts/fix_french_typography.py ../path/to/french.md
```

The command edits the file in place; add `--check` to report whether changes
are needed without writing. JSON keys are left unchanged. Markdown code blocks,
inline code, link destinations, and common placeholders are protected. The
fixer is heuristic, not a Markdown parser or a linguistic review: inspect the
diff, especially for unusual markup, technical identifiers, or literal quotes.
It preserves the option of no space before `?`, `!`, and `;`.
