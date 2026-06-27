import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base: "./" keeps all asset URLs relative, so the same build works locally and
// on a GitHub Pages project site (https://user.github.io/<repo>/) without
// hardcoding the repo name. Public JSON assets are fetched via BASE_URL.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
