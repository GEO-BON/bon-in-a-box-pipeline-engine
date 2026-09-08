import { createContext } from "react";

/**
 * Instance-wide facts the whole tree may need: which optional features are on.
 *
 * Populated in index.jsx from /fm-api/is_disabled (the file manager, which is also
 * python-api's liveness probe) and /api/status (everything else). Consumers destructure
 * off it, so the default has to be an object with the same shape -- it used to be the
 * string 'false', which made every `const { disableMyFiles } = useContext(uiContext)`
 * yield undefined before the provider mounted.
 *
 * Defaults are the permissive ones, matching index.jsx: a UI that cannot read the flags
 * behaves as it did before they existed, and the server still enforces every one of
 * them regardless of what is rendered here.
 */
export const uiContext = createContext({
  disableMyFiles: false,
  runsEnabled: true,
  savePipelineToServer: true,
  condaPackEnabled: true,
  antivirusEnabled: false,
  antivirusReachable: null,
});
