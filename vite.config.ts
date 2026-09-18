import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function fileProtocolHtml() {
  return {
    name: "file-protocol-html",
    apply: "build" as const,
    enforce: "post" as const,
    transformIndexHtml(html: string) {
      return html
        .replace(/<link rel="modulepreload"[^>]*>/g, "")
        .replace(
          /<script type="module"([^>]*)><\/script>/g,
          (_match, attrs: string) => {
            const src = /src="([^"]+)"/.exec(attrs);
            return src ? `<script defer src="${src[1]}"></script>` : "";
          },
        )
        .replace(/ crossorigin(="[^"]*")?/g, "");
    },
  };
}

export default defineConfig({
  plugins: [react(), fileProtocolHtml()],
  base: "./",
  server: {
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      exceljs: "exceljs/dist/exceljs.min.js",
    },
  },
  build: {
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: "iife",
        name: "AirportCapacity",
        inlineDynamicImports: true,
        entryFileNames: "assets/app.js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
