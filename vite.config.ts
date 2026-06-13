import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist/renderer",
  },
  server: {
    watch: {
      ignored: ["**/hius-dt-jw-todo/**", "**/dist/electron/**", "**/dist/release/**", "**/log/**"],
    },
  },
});
