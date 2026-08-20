import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyInput } from '../src/lib/classifier';
test('classifies common intake types deterministically', () => { assert.equal(classifyInput('https://www.youtube.com/watch?v=abc'), 'VIDEO'); assert.equal(classifyInput('https://arxiv.org/abs/1234'), 'PAPER'); assert.equal(classifyInput('A news headline about markets'), 'NEWS_POST'); assert.equal(classifyInput('Trader profile: Jane Doe'), 'TRADER_PERSONA'); assert.equal(classifyInput('AAPL'), 'ASSET'); assert.equal(classifyInput('something untyped'), 'UNKNOWN'); });
