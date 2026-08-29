import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Un solo proceso: varios tests tocan `dist/` y el disco, y correrlos en
    // paralelo los haría interferir entre sí por motivos que no son el código.
    fileParallelism: false,
    environment: 'node',
  },
})
