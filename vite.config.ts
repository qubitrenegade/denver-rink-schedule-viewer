import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
    return {
      define: {
        // use production api for both modes for testing
        // TODO: fix this
        'import.meta.env.WORKER_API_BASE': JSON.stringify(
          mode === 'production' ? 'https://api.geticeti.me' : 'http://localhost:8787'
        )
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Set base path for GitHub Pages
      base: mode === 'production' ? './' : '/',

      // Serve data files during development
      server: {
        fs: {
          allow: ['..']
        }
      }
    };
});
