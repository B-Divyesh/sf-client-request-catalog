import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const binary = new URL('../backend/target/debug/client-request-catalog-server', import.meta.url).pathname;

async function start(port, dataDir, extra = {}, omitPort = false) {
  const env = { PATH: process.env.PATH, DATA_DIR: dataDir, APP_ENV: 'test', AUTH_TEST_TOKEN: 'runtime-token', AUTH_TEST_OID: 'runtime-owner', ...extra };
  if (!omitPort) env.PORT = String(port);
  const child = spawn(binary, [], {
    env,
    stdio: ['ignore', 'ignore', 'pipe']
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`server exited ${child.exitCode}`);
    try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return child; } catch { /* server is still starting */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  child.kill('SIGTERM');
  throw new Error('server did not become ready');
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
}

test('@claim:operator-config environment overrides and SQLite persistence work', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'crc-runtime-'));
  const defaultDataDir = await mkdtemp(join(tmpdir(), 'crc-default-port-'));
  const port = 18921;
  const headers = { authorization: 'Bearer runtime-token', 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.240' };
  let server = await start(port, dataDir, {
    ENTRA_TENANT_ID: '11111111-1111-4111-8111-111111111111',
    ENTRA_TENANT_SUBDOMAIN: 'exampletenant',
    ENTRA_CLIENT_ID: '22222222-2222-4222-8222-222222222222'
  });
  try {
    const config = await (await fetch(`http://127.0.0.1:${port}/api/auth/config`, { headers: { 'x-forwarded-for': '198.51.100.241' } })).json();
    assert.equal(config.authority, 'https://exampletenant.ciamlogin.com/11111111-1111-4111-8111-111111111111/');
    assert.equal(config.client_id, '22222222-2222-4222-8222-222222222222');
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/setup`, { method: 'POST', headers, body: JSON.stringify({ business_name: 'Persistent Workshop' }) })).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/admin/products`, { method: 'POST', headers, body: JSON.stringify({ name: 'Persistent offer', description: 'Survives a restart', price_cents: '1200' }) })).status, 200);
    await stop(server);
    server = await start(port, dataDir);
    const overview = await (await fetch(`http://127.0.0.1:${port}/api/admin/overview`, { headers })).json();
    assert.equal(overview.business_name, 'Persistent Workshop');
    assert.ok(overview.products.some(product => product.name === 'Persistent offer'));
  } finally {
    await stop(server);
    const defaultPortServer = await start(8080, defaultDataDir, {}, true);
    try {
      assert.equal((await fetch('http://127.0.0.1:8080/health')).status, 200);
    } finally {
      await stop(defaultPortServer);
    }
    await rm(dataDir, { recursive: true, force: true });
    await rm(defaultDataDir, { recursive: true, force: true });
  }
});
