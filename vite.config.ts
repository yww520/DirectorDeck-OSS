import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      strictPort: true, // 确保使用 3000 端口，如被占用则报错
      host: '0.0.0.0',
      proxy: {
        '/jimeng-api': {
          target: 'http://127.0.0.1:8046',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/jimeng-api/, '')
        },
        '/antigravity-api': {
          target: 'http://127.0.0.1:8045',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/antigravity-api/, '')
        }
      }
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
