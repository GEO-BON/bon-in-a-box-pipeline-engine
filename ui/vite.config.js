import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const result = dotenv.config({ 
    path: path.resolve(__dirname, '../pipeline-repo/runner.env'),
    override: true,
});

// debugging
// console.log("dotenv result:", result);
console.log("resolved path:", path.resolve(__dirname, '../pipeline-repo/runner.env'));
console.log("DISABLE_MY_FILES from process.env:", process.env.DISABLE_MY_FILES);

export default defineConfig({
    plugins: [react()],
    base: "/",
    server: {
        open: true, // Automatically open the app in the browser
        port: 3000,
        allowedHosts: ["biab-ui"],
    },
    resolve: {
        preserveSymlinks: true, //Needed for BonInABoxScriptService to load
    },
    // added this so we can read the DISABLE_MY_FILES var (in /pipeline-repo/runner.env)
    define: {
        'import.meta.env.DISABLE_MY_FILES': JSON.stringify(process.env.DISABLE_MY_FILES),
    },
});


