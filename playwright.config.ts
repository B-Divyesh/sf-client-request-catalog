import { defineConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const e2eDataDir = '/tmp/client-request-catalog-e2e';
mkdirSync(e2eDataDir, { recursive: true });

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:8123', browserName: 'chromium' },
  webServer: {
    command: `DATA_DIR=${e2eDataDir} APP_ENV=test AUTH_TEST_TOKEN=e2e-test-entra-token AUTH_TEST_OID=00000000-0000-4000-8000-000000000001 PORT=8123 backend/target/debug/client-request-catalog-server`,
    url: 'http://127.0.0.1:8123/health',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
