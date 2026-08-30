import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:8123', browserName: 'chromium' },
  webServer: {
    command: 'DATA_DIR=$(mktemp -d /tmp/crc-e2e.XXXXXX) OWNER_CODE=e2e-owner-code-12345 PORT=8123 backend/target/debug/client-request-catalog-server',
    url: 'http://127.0.0.1:8123/health',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
