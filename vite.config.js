import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      fileName: "index",
      formats: ["es"],
    },
    sourcemap: true,
  },
  plugins: [
    dts({
      outDir: "dist",
      include: ["src/index.ts"],
    }),
  ],
  test: {
    environment: "node",
    coverage: {
      reporter: ["text", "lcov", "clover"],
    },
  },
});
