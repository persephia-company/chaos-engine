import tsconfigPaths from 'vite-tsconfig-paths';
import {configDefaults, defineConfig} from 'vitest/config';

const config = defineConfig({
  test: {
    ...configDefaults,
  },
  plugins: [tsconfigPaths()],
});

export default config;
