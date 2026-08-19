import { configDefaults, defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    css: true,
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
