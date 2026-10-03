import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { assetEnginePlugin } from './server/assetPlugin';

export default defineConfig({
  plugins: [react(), assetEnginePlugin()],
});
