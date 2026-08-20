import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../src/app/api/cases/route';
test('API rejects malformed JSON intake', async () => { const response = await POST(new Request('http://localhost/api/cases', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'url', value: 'file:///etc/passwd' }) })); assert.equal(response.status, 400); });
