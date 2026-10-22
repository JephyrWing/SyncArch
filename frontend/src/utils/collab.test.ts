import test from 'node:test';
import assert from 'node:assert/strict';
import { clearReferences, findReferences, renameColumn, renameTable } from './erdRename.ts';
import { describeChanges, diffPayload } from './documentDiff.ts';
import { toTeamMembers } from '../adapters/projectAdapter.ts';
import type { DocumentPayload, ErdColumn, ErdTable } from '../types/index.ts';

const column = (id: string, name: string, extra: Partial<ErdColumn> = {}): ErdColumn => ({
  id, name, dataType: 'UUID', isPrimaryKey: false, isForeignKey: false, isUnique: false, isNullable: false, comment: '', ...extra,
});

const tables: ErdTable[] = [
  { id: 't-users', name: 'users', comment: '', relatedFeatureIds: [], x: 0, y: 0,
    columns: [column('u-id', 'id', { isPrimaryKey: true }), column('u-boss', 'boss_id', { isForeignKey: true, references: 'users.id' })] },
  { id: 't-orders', name: 'orders', comment: '', relatedFeatureIds: [], x: 0, y: 0,
    columns: [column('o-id', 'id', { isPrimaryKey: true }), column('o-user', 'user_id', { isForeignKey: true, references: 'Users.id' })] },
  { id: 't-items', name: 'items', comment: '', relatedFeatureIds: [], x: 0, y: 0,
    columns: [column('i-order', 'order_id', { isForeignKey: true, references: 'orders.id' })] },
];

test('renameTable updates every FK reference, including self and differently cased ones', () => {
  assert.deepEqual(findReferences(tables, 'users').map((r) => `${r.tableName}.${r.columnName}`), ['users.boss_id', 'orders.user_id']);
  const renamed = renameTable(tables, 't-users', 'members');
  assert.equal(renamed[0].name, 'members');
  assert.equal(renamed[0].columns[1].references, 'members.id');
  assert.equal(renamed[1].columns[1].references, 'members.id');
  assert.equal(renamed[2].columns[0].references, 'orders.id');
  assert.equal(tables[0].name, 'users', 'input must not be mutated');
});

test('renameColumn only rewrites references to that table and column', () => {
  const renamed = renameColumn(tables, 't-orders', 'o-id', 'order_no');
  assert.equal(renamed[1].columns[0].name, 'order_no');
  assert.equal(renamed[2].columns[0].references, 'orders.order_no');
  assert.equal(renamed[1].columns[1].references, 'Users.id');
  assert.deepEqual(findReferences(renamed, 'orders', 'id'), []);
});

test('clearReferences unmarks FKs to a deleted table but keeps the columns', () => {
  const cleared = clearReferences(tables.filter((t) => t.id !== 't-users'), 'users');
  assert.deepEqual(cleared[0].columns[1], { ...tables[1].columns[1], isForeignKey: false, references: undefined });
  assert.equal(cleared[1].columns[0].references, 'orders.id');
  assert.equal(clearReferences(tables, 'nothing'), tables);
});

const payload = (tablesInDoc: ErdTable[]): DocumentPayload => ({
  schemaVersion: 1, ideas: [], features: [], nodes: [], connections: [], tables: tablesInDoc,
});

test('diffPayload reports added, modified and deleted items by id', () => {
  const after = payload([{ ...tables[1], comment: '주문' }, tables[2], { ...tables[0], id: 't-new', name: 'audit' }]);
  assert.deepEqual(diffPayload(payload(tables), after), [
    { area: 'ERD', name: 'orders', kind: '수정' },
    { area: 'ERD', name: 'audit', kind: '추가' },
    { area: 'ERD', name: 'users', kind: '삭제' },
  ]);
  assert.deepEqual(diffPayload(null, after), []);
});

test('describeChanges names the actor, first change and version', () => {
  assert.equal(
    describeChanges('맹동영', [{ area: 'ERD', name: 'orders', kind: '수정' }, { area: 'ERD', name: 'audit', kind: '추가' }], 8),
    "맹동영님이 ERD 'orders' 항목을 수정했습니다 (외 1건) · v8"
  );
  assert.equal(describeChanges('밥', [], 3), '밥님이 프로젝트 정보를 저장했습니다 · v3');
});

test('diffPayload names lines by their nodes and reports position-only edits as moves', () => {
  const node = (id: string, x = 0) => ({ id, category: 'Service' as const, name: id.toUpperCase(), techStack: [], x, y: 0, description: '' });
  const before: DocumentPayload = { ...payload([]), nodes: [node('a'), node('b')] };
  const after: DocumentPayload = { ...before, nodes: [node('a', 80), node('b')], connections: [{ id: 'c1', sourceId: 'a', targetId: 'b', protocol: 'REST' }] };
  assert.deepEqual(diffPayload(before, after), [
    { area: '시스템', name: 'A', kind: '이동' },
    { area: '연결선', name: 'A → B', kind: '추가' },
  ]);
});

test('toTeamMembers tells apart members who share a display name', () => {
  const member = (userId: string, displayName: string, loginId: string) => ({ userId, displayName, loginId, role: 'EDITOR' as const, joinedAt: '' });
  const names = toTeamMembers([member('1', '전설민', 'junseolmin91@gmail.com'), member('2', '전설민', 'junseolmin999@gmail.com'), member('3', '밥', 'bob@x.test')]).map((m) => m.name);
  assert.deepEqual(names, ['전설민 (junseolmin91)', '전설민 (junseolmin999)', '밥']);
  const sameLocal = toTeamMembers([member('1', '알렉스', 'alex@gmail.com'), member('2', '알렉스', 'alex@company.com')]).map((m) => m.name);
  assert.deepEqual(sameLocal, ['알렉스 (alex@gmail.com)', '알렉스 (alex@company.com)']);
});
