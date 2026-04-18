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
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;

          // Heavy 3D libraries — only loaded when ThreeBackground mounts
          if (
            id.includes("/three/") ||
            id.includes("@react-three/fiber") ||
            id.includes("@react-three/drei")
          ) {
            return "three-vendor";
          }

          // Charts (recharts is huge)
          if (id.includes("recharts") || id.includes("d3-")) {
            return "chart-vendor";
          }

          // Animation library
          if (id.includes("framer-motion")) {
            return "motion-vendor";
          }

          // Carousel
          if (id.includes("swiper")) {
            return "swiper-vendor";
          }

          // Radix UI components
          if (id.includes("@radix-ui")) {
            return "ui-vendor";
          }

          // Supabase client
          if (id.includes("@supabase")) {
            return "supabase-vendor";
          }

          // Markdown rendering
          if (
            id.includes("react-markdown") ||
            id.includes("remark-") ||
            id.includes("rehype-") ||
            id.includes("micromark") ||
            id.includes("mdast-")
          ) {
            return "markdown-vendor";
          }

          // React core stays in main vendor for fastest startup
          return undefined;
        },
      },
    },
  },
}));
