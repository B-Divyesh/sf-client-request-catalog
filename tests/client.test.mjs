import test from 'node:test';
import assert from 'node:assert/strict';

test('request form requires contact details and at least one item', () => {
  const valid = ({ name, email, items }) => Boolean(name.trim() && email.includes('@') && items.length);
  assert.equal(valid({ name: 'Ava', email: 'ava@example.test', items: [{ id: 1 }] }), true);
  assert.equal(valid({ name: '', email: 'ava@example.test', items: [{ id: 1 }] }), false);
  assert.equal(valid({ name: 'Ava', email: 'nope', items: [{ id: 1 }] }), false);
  assert.equal(valid({ name: 'Ava', email: 'ava@example.test', items: [] }), false);
});
