import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    server: {
        port: 3000,
        open: true,
        headers: {
            'Cache-Control': 'no-store',
            Pragma: 'no-cache',
            Expires: '0'
        }
    },
    build: {
        outDir: 'dist',
        sourcemap: true
    }
});
