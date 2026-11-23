import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";


const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));


// Each element is its own page. `npm run build` writes them straight into
// the website's scenes/ folder (scenes/element1/index.html, ...).
export default defineConfig({
    base: "./", // relative paths so the scenes work inside sub-folders on GitHub Pages
    build: {
        outDir: here("../scenes"),
        emptyOutDir: true,
        target: "es2022",
        assetsInlineLimit: 0,
        chunkSizeWarningLimit: 8000,
        rollupOptions: {
            input: {
                element1: here("./element1/index.html"),
                element2: here("./element2/index.html"),
                element3: here("./element3/index.html"),
                element4: here("./element4/index.html"),
                element5: here("./element5/index.html")
            }
        }
    },
    // Havok ships a .wasm file that Vite must not pre-bundle
    optimizeDeps: { exclude: ["@babylonjs/havok"] },
    server: { open: true }
});
