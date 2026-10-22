import test from 'node:test';
import assert from 'node:assert/strict';
import { voteCount } from './votes.ts';
import { merge3 } from './mergeDocument.ts';

test('voteCount: legacy votes plus voterIds', () => {
  assert.equal(voteCount({ votes: 2, voterIds: ['a'] }), 3);
  assert.equal(voteCount({ votes: 0 }), 0);
});

test('voterIds: two people voting at once keep both votes', () => {
  assert.deepEqual(merge3(['a'], ['a', 'me'], ['a', 'other']), ['a', 'me', 'other']);
});
