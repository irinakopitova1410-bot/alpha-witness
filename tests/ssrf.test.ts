import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeUrl, isBlockedAddress } from '../src/lib/ssrf';
test('blocks private and reserved addresses', () => { assert.equal(isBlockedAddress('127.0.0.1'), true); assert.equal(isBlockedAddress('10.0.0.2'), true); assert.equal(isBlockedAddress('192.168.1.1'), true); assert.equal(isBlockedAddress('8.8.8.8'), false); });
test('rejects unsafe URL schemes and localhost', async () => { await assert.rejects(() => assertSafeUrl('file:///etc/passwd')); await assert.rejects(() => assertSafeUrl('http://localhost:3000')); });
