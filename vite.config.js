import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  // Move cache outside of node_modules to avoid Dropbox/Windows Defender file-lock crashes
  cacheDir: '.vite-cache',
  optimizeDeps: { 
    noDiscovery: true,
    include: []
  },
  plugins: [
    basicSsl()
  ],
  // Setting base to './' ensures that the game can be hosted in any subdirectory 
  // (e.g., yourwebsite.com/neonsurge/) without broken asset paths.
  base: './',
});
// Triggering server reload...
