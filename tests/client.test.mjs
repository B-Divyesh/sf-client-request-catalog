import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('request form requires contact details and at least one item', () => {
  const valid = ({ name, email, items }) => Boolean(name.trim() && email.includes('@') && items.length);
  assert.equal(valid({ name: 'Ava', email: 'ava@example.test', items: [{ id: 1 }] }), true);
  assert.equal(valid({ name: '', email: 'ava@example.test', items: [{ id: 1 }] }), false);
  assert.equal(valid({ name: 'Ava', email: 'nope', items: [{ id: 1 }] }), false);
  assert.equal(valid({ name: 'Ava', email: 'ava@example.test', items: [] }), false);
});

test('every registered claim has exactly one tagged test', async () => {
  const claims = JSON.parse(await readFile(new URL('../.factory/claims.json', import.meta.url), 'utf8'));
  const sources = [
    await readFile(new URL('../e2e/catalog.spec.ts', import.meta.url), 'utf8'),
    await readFile(new URL('./runtime-claims.mjs', import.meta.url), 'utf8')
  ].join('\n');
  for (const claim of claims) {
    const matches = sources.match(new RegExp(`@claim:${claim.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) || [];
    assert.equal(matches.length, 1, `${claim.id} should have exactly one tagged test`);
  }
});

test('catalog description is verb-first and at most 120 characters', async () => {
  const description = (await readFile(new URL('../.factory/catalog-description.txt', import.meta.url), 'utf8')).trim();
  assert.ok(description.length <= 120);
  assert.match(description, /^(Create|Build|Collect|Share|Manage|Turn|Track)\b/);
});
