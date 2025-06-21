import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Only require environment variables for production builds
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production') {
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
      throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be defined in your .env file for production builds');
    }
  }

  return {
    server: {
      host: "0.0.0.0",
      port: 8080,
      proxy: {
        '/functions/v1': {
          target: env.VITE_SUPABASE_URL,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
      basicSsl(),
      mode === 'development' &&
      componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      outDir: 'dist',
    },
    preview: {
      port: 8080,
      strictPort: true,
    },
  }
});
