import test from 'node:test';
import assert from 'node:assert/strict';
import { toProjectData } from '../adapters/projectAdapter.ts';
import type { DocumentView } from '../types/index.ts';

test('minimal API ERD gets display defaults without mutating payload or overwriting false and zero values', () => {
  const view = { project: { id: 'p', title: '최소 문서', summary: '', categoryTag: '', targetDbms: 'mariadb' },
    version: 1, updatedAt: '2026-10-22T00:00:00Z', payload: { schemaVersion: 2, ideas: [], features: [], nodes: [], connections: [],
      tables: [{ id: 't', name: 'sample', x: 0, y: 0,
        columns: [{ id: 'c', name: 'id', dataType: 'INT', isPrimaryKey: true, isNullable: false }] }] } } as unknown as DocumentView;
  const before = structuredClone(view);
  const table = toProjectData(view, 4).tables[0];
  assert.deepEqual(table.relatedFeatureIds, []);
  assert.equal(table.comment, '');
  assert.equal(table.x, 0);
  assert.equal(table.y, 0);
  assert.equal(table.columns[0].isNullable, false);
  assert.equal(table.columns[0].isPrimaryKey, true);
  assert.equal(table.columns[0].isForeignKey, false);
  assert.equal(table.columns[0].isUnique, false);
  assert.equal(table.columns[0].comment, '');
  assert.deepEqual(view, before);
});
