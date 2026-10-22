import test from 'node:test';
import assert from 'node:assert/strict';
import { merge3, mergeProject } from './mergeDocument.ts';
import type { ArchConnection, ArchNode, ErdColumn, ErdTable, ProjectData } from '../types/index.ts';

const node = (id: string, extra: Partial<ArchNode> = {}): ArchNode => ({
  id, category: 'Service', name: id, techStack: [], x: 0, y: 0, description: '', ...extra,
});
const line = (id: string, sourceId: string, targetId: string): ArchConnection => ({ id, sourceId, targetId, protocol: 'REST' });

const project = (fields: Partial<ProjectData> = {}): ProjectData => ({
  id: 'p', title: '설계', summary: '', categoryTag: '', targetDbms: 'mariadb', currentStep: 1,
  stepLocks: { 1: false, 2: false, 3: false, 4: false }, ideas: [], features: [], nodes: [], connections: [],
  archVersions: [], tables: [], updatedAt: 't0', ...fields,
});

test('merge3 keeps both sides when they touch different fields of the same item', () => {
  const base = project({ nodes: [node('api')] });
  const local = project({ nodes: [node('api', { x: 120, y: 40 })] });
  const remote = project({ nodes: [node('api', { name: 'API 서버' })], updatedAt: 't1' });
  const merged = mergeProject(base, local, remote);
  assert.deepEqual(merged.nodes, [node('api', { name: 'API 서버', x: 120, y: 40 })]);
  assert.equal(merged.updatedAt, 't1');
});

test('merge3 keeps lines both people drew at the same time, in the remote order', () => {
  const base = project({ nodes: [node('a'), node('b'), node('c')] });
  const local = project({ ...base, connections: [line('mine', 'a', 'b')] });
  const remote = project({ ...base, connections: [line('theirs', 'b', 'c')] });
  assert.deepEqual(mergeProject(base, local, remote).connections.map((c) => c.id), ['theirs', 'mine']);
  const prepended = merge3([{ id: 'x' }], [{ id: 'x' }, { id: 'm' }], [{ id: 'r' }, { id: 'x' }]);
  assert.deepEqual(prepended, [{ id: 'r' }, { id: 'x' }, { id: 'm' }]);
});

test('merge3 applies a remote delete unless I edited that item', () => {
  const base = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }];
  assert.deepEqual(merge3(base, base, [{ id: 'b', v: 1 }]), [{ id: 'b', v: 1 }]);
  assert.deepEqual(merge3(base, [{ id: 'a', v: 2 }, { id: 'b', v: 1 }], [{ id: 'b', v: 1 }]), [{ id: 'a', v: 2 }, { id: 'b', v: 1 }]);
  // [협업 상태] 내가 지운 항목은 팀원이 고치지 않았으면 지운 채로 둔다.
  assert.deepEqual(merge3(base, [{ id: 'b', v: 1 }], base), [{ id: 'b', v: 1 }]);
  assert.deepEqual(merge3(base, [{ id: 'b', v: 1 }], [{ id: 'a', v: 3 }, { id: 'b', v: 1 }]), [{ id: 'a', v: 3 }, { id: 'b', v: 1 }]);
});

test('merge3 prefers my value when both sides changed the same field', () => {
  assert.deepEqual(merge3({ name: 'a', x: 0 }, { name: 'mine', x: 0 }, { name: 'theirs', x: 5 }), { name: 'mine', x: 5 });
  assert.equal(merge3('a', 'b', 'a'), 'b');
  assert.equal(merge3('a', 'a', 'c'), 'c');
});

test('merge3 unions value lists such as votes from two people', () => {
  assert.deepEqual(merge3(['앨리스'], ['앨리스', '밥'], ['앨리스', '캐럴']), ['앨리스', '밥', '캐럴']);
  assert.deepEqual(merge3(['a', 'b'], ['a', 'b', 'c'], ['b']), ['b', 'c']);
});

test('mergeProject drops lines whose node a teammate deleted', () => {
  const base = project({ nodes: [node('a'), node('b')] });
  const local = project({ ...base, connections: [line('l1', 'a', 'b')] });
  const remote = project({ nodes: [node('a')] });
  const merged = mergeProject(base, local, remote);
  assert.deepEqual(merged.nodes.map((n) => n.id), ['a']);
  assert.deepEqual(merged.connections, []);
});

test('mergeProject adds up votes two people cast at the same time', () => {
  const idea = (votedBy: string[]) => ({ id: 'i1', category: 'actors' as const, title: '로그인', description: '', author: '앨리스', votes: votedBy.length, votedBy, comments: [] });
  const merged = mergeProject(project({ ideas: [idea(['앨리스'])] }), project({ ideas: [idea(['앨리스', '밥'])] }), project({ ideas: [idea(['앨리스', '캐럴'])] }));
  assert.deepEqual([merged.ideas[0].votes, merged.ideas[0].votedBy], [3, ['앨리스', '밥', '캐럴']]);
  // [협업 상태] 같은 사람이 두 탭에서 동시에 투표하면 한 표만 남는다.
  const twice = mergeProject(project({ ideas: [idea([])] }), project({ ideas: [idea(['밥'])] }), project({ ideas: [idea(['밥'])] }));
  assert.deepEqual([twice.ideas[0].votes, twice.ideas[0].votedBy], [1, ['밥']]);
  const split = mergeProject(project({ ideas: [idea(['밥'])] }), project({ ideas: [idea([])] }), project({ ideas: [idea(['밥', '캐럴'])] }));
  assert.deepEqual([split.ideas[0].votes, split.ideas[0].votedBy], [1, ['캐럴']]);
  const swapped = mergeProject(project({ ideas: [idea(['a'])] }), project({ ideas: [idea(['a', 'b'])] }), project({ ideas: [idea(['b'])] }));
  assert.deepEqual([swapped.ideas[0].votes, swapped.ideas[0].votedBy], [1, ['b']]);
});

test('mergeProject repoints FKs written with a name a teammate renamed meanwhile', () => {
  const col = (id: string, name: string, extra: Partial<ErdColumn> = {}): ErdColumn => ({
    id, name, dataType: 'BIGINT', isPrimaryKey: false, isForeignKey: false, isUnique: false, isNullable: false, comment: '', ...extra,
  });
  const table = (id: string, name: string, columns: ErdColumn[]): ErdTable => ({ id, name, comment: '', relatedFeatureIds: [], columns, x: 0, y: 0 });
  const users = table('t-u', 'users', [col('u-id', 'id', { isPrimaryKey: true })]);
  const orders = table('t-o', 'orders', [col('o-id', 'id')]);
  const base = project({ tables: [users, orders] });
  const local = project({ tables: [users, { ...orders, columns: [...orders.columns, col('o-u', 'user_id', { isForeignKey: true, references: 'users.id' })] }] });
  const remote = project({ tables: [table('t-u', 'accounts', [col('u-id', 'account_id', { isPrimaryKey: true })]), orders] });
  const merged = mergeProject(base, local, remote);
  assert.deepEqual(merged.tables.map((t) => t.name), ['accounts', 'orders']);
  assert.equal(merged.tables[1].columns[1].references, 'accounts.account_id');

  // [협업 상태] 한쪽은 테이블 이름, 다른 쪽은 컬럼 이름을 바꿔도 기존 FK가 최종 이름을 따라간다.
  const linked = project({ tables: [users, { ...orders, columns: [col('o-u', 'user_id', { isForeignKey: true, references: 'users.id' })] }] });
  const tableRenamed = project({ tables: [{ ...users, name: 'accounts' }, { ...linked.tables[1], columns: [col('o-u', 'user_id', { isForeignKey: true, references: 'accounts.id' })] }] });
  const columnRenamed = project({ tables: [{ ...users, columns: [col('u-id', 'account_id', { isPrimaryKey: true })] }, { ...linked.tables[1], columns: [col('o-u', 'user_id', { isForeignKey: true, references: 'users.account_id' })] }] });
  for (const [mine, theirs] of [[tableRenamed, columnRenamed], [columnRenamed, tableRenamed]]) {
    assert.equal(mergeProject(linked, mine, theirs).tables[1].columns[0].references, 'accounts.account_id');
  }
});
