import { defineConfig } from 'vitest/config';

// Tests propres au site : npx vitest run --config site/vitest.config.ts
export default defineConfig({ test: { include: ['site/tests/**/*.test.ts'], root: '.' } });
