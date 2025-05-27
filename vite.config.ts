import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Set base path for GitHub Pages
      base: process.env.NODE_ENV === 'production' ? '/denver-rink-schedule-viewer/' : '/',
      
      // Serve data files during development
      server: {
        fs: {
          allow: ['..']
        }
      }
    };
});
