import test from 'node:test';
import assert from 'node:assert/strict';
import { makeVerdict } from '../src/lib/verdict';
test('incomplete evidence never authorizes paper test', () => { assert.equal(makeVerdict('ASSET', 1, false).decision, 'WATCH'); assert.equal(makeVerdict('UNKNOWN', 0, false).decision, 'VETO'); assert.notEqual(makeVerdict('ASSET', 3, true).decision, 'PAPER_TEST'); });
