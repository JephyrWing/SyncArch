import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteIdeaBranch, ideaBranchIds } from './ideaDeletion.ts';
import type { ProjectData } from '../types/index.ts';

test('idea branch deletion clears feature origins and preserves unrelated ideas and features', () => {
  const project = { ideas: [{ id: 'root' }, { id: 'child', parentIdeaId: 'root' },
    { id: 'leaf', parentIdeaId: 'child' }, { id: 'other' }],
    features: [{ id: 'linked', relatedStoryId: 'leaf' }, { id: 'kept', relatedStoryId: 'other' }],
  } as ProjectData;
  const before = structuredClone(project);
  assert.deepEqual([...ideaBranchIds(project.ideas, 'root')], ['root', 'child', 'leaf']);
  const next = deleteIdeaBranch(project, 'root');
  assert.deepEqual(next.ideas.map((idea) => idea.id), ['other']);
  assert.deepEqual(next.features, [{ id: 'linked', relatedStoryId: undefined }, { id: 'kept', relatedStoryId: 'other' }]);
  assert.deepEqual(project, before);
  assert.deepEqual(deleteIdeaBranch(project, 'missing'), project);
});

test('idea deletion impact terminates on cycles without collecting unrelated roots', () => {
  const project = { ideas: [{ id: 'a', parentIdeaId: 'b' }, { id: 'b', parentIdeaId: 'a' }, { id: 'other' }] } as ProjectData;
  assert.deepEqual([...ideaBranchIds(project.ideas, 'a')], ['a', 'b']);
});
