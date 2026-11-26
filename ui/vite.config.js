import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    test: {
        include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
    },
    base: "/",
    server: {
        open: true, // Automatically open the app in the browser
        port: 3000,
        allowedHosts: ["biab-ui"],
    },
    resolve: {
        preserveSymlinks: true, //Needed for BonInABoxScriptService to load
    },
});

