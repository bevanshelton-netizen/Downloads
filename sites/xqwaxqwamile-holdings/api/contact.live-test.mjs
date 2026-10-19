import assert from 'node:assert/strict';

const base = 'https://www.xqwaxqwamile.com/api/contact';

const get = await fetch(base, { redirect: 'manual' });
assert.notEqual(get.status, 404, `contact endpoint is not deployed: HTTP ${get.status}`);
assert.equal(get.status, 405, `expected GET to be rejected by the live contact API, got HTTP ${get.status}`);

const post = await fetch(base, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: '', email: 'acceptance@example.com', message: '' })
});
assert.equal(post.status, 400, `expected live validation response 400, got HTTP ${post.status}`);

console.log('XQWAXQWAMILE live contact API gate passed');
