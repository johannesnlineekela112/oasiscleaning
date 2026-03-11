import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // mapbox-gl 3.x uses import.meta.url-based workers which esbuild cannot
  // pre-bundle. Excluding it here tells Vite to let Rollup handle it directly
  // during the production build, which supports the worker pattern correctly.
  optimizeDeps: {
    exclude: ["mapbox-gl"],
  },
  build: {
    rollupOptions: {
      // Prevent Rollup from trying to inline mapbox-gl workers
      output: {
        manualChunks: (id) => {
          if (id.includes("mapbox-gl")) return "mapbox-gl";
        },
      },
    },
  },
}));
