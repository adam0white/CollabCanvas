import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const publishableKey =
    env.CLERK_PUBLISHABLE_KEY ?? env.VITE_CLERK_PUBLISHABLE_KEY ?? "";

  return {
    plugins: [react()],
    define: {
      "window.__CLERK_PUBLISHABLE_KEY__": JSON.stringify(publishableKey),
    },
  };
});
