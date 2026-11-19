import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { retroCloudBackendPlugin } from './server/apiMiddleware';

export default defineConfig({
  plugins: [react(), retroCloudBackendPlugin()],
  server: {
    port: 5173,
    host: true,
  },
});
