import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        // Add worker API base URL for proper environment detection
        'import.meta.env.WORKER_API_BASE': JSON.stringify('https://api.geticeti.me')
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
