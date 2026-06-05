import { defineConfig } from "vite";

export default defineConfig({
  server: {
    watch: {
      ignored: ["**/hius-dt-jw-todo/**", "**/dist-electron/**"],
    },
  },
});
