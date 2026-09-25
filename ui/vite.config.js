import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    base: "/",
    server: {
        open: true, // Automatically open the app in the browser
        port: 3000,
        allowedHosts: ["biab-ui"],
        proxy: {
            // Only needed when running the dev server on its own; behind the
            // http-proxy container this path is already handled by nginx. Keeps
            // /oauth2/userinfo same-origin either way, which is what avoids CORS.
            "/oauth2/userinfo": {
                target: "https://auth.bee.geobon.org",
                changeOrigin: true,
                secure: true,
            },
        },
    },
    resolve: {
        preserveSymlinks: true, //Needed for BonInABoxScriptService to load
    },
});


