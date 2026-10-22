import test from 'node:test';
import assert from 'node:assert/strict';
import { unlinkFeature } from './erdRename.ts';
import type { ErdTable } from '../types/index.ts';

test('deleting a feature clears table and column links but preserves IDs, FK and other features', () => {
  const tables: ErdTable[] = [{ id: 't', name: 'orders', comment: '', x: 0, y: 0, relatedFeatureIds: ['removed', 'kept'],
    columns: [{ id: 'c', name: 'parent_id', dataType: 'INT', isPrimaryKey: false, isForeignKey: true,
      references: 'parents.id', isUnique: false, isNullable: true, comment: '', relatedFeatureId: 'removed' }] }];
  const before = structuredClone(tables);
  const next = unlinkFeature(tables, 'removed');
  assert.deepEqual(next[0].relatedFeatureIds, ['kept']);
  assert.equal(next[0].columns[0].relatedFeatureId, undefined);
  assert.equal(next[0].columns[0].references, 'parents.id');
  assert.equal(next[0].columns[0].id, 'c');
  assert.deepEqual(tables, before);
});
