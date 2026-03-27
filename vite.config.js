import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import legacy from '@vitejs/plugin-legacy';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ],
  
  root: '.',
  base: './',
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        todos: resolve(__dirname, 'todos-chamados.html'),
        analise: resolve(__dirname, 'analise-tendencias.html'),
        detalhe: resolve(__dirname, 'chamado-detalhe.html'),
        parque: resolve(__dirname, 'parque-equipamentos.html')
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    cssCodeSplit: 'manual',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1000
  },
  
  server: {
    port: 3000,
    host: true,
    open: true,
    cors: true
  },
  
  preview: {
    port: 4173,
    host: true
  },
  
  optimizeDeps: {
    include: ['@supabase/supabase-js']
  },
  
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      scss: {
        additionalData: `@import "css/styles.css";`
      }
    }
  },
  
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString())
  }
});
