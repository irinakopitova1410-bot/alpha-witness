import test from 'node:test';
import assert from 'node:assert/strict';
import { robotsAllowsPath } from '../src/lib/processor';
import { POST } from '../src/app/api/cases/[id]/notes/route';

test('robots parser recognizes real newline-separated Disallow rules', () => {
  assert.equal(robotsAllowsPath('User-agent: *\nDisallow: /private\n', '/private/report'), false);
  assert.equal(robotsAllowsPath('User-agent: *\r\nDisallow: /private\r\n', '/public'), true);
});
test('guest private-note writes are disabled without owner authentication', async () => {
  const response = await POST();
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'NOTES_REQUIRE_OWNER_AUTHENTICATION');
});
