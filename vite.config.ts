import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { componentTagger } from "lovable-tagger";

// Resolve paths relative to this config file (NOT process.cwd()), so @/ works reliably in Lovable.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcPath = path.resolve(__dirname, "src").replace(/\\/g, "/");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    tsconfigPaths(),
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      { find: /^@\//, replacement: `${srcPath}/` },
      { find: "@", replacement: srcPath },
    ],
  },
}));

