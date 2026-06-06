import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    watch: {
      ignored: ["**/hius-dt-jw-todo/**", "**/dist-electron/**"],
    },
  },
});
