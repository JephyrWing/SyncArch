import type { ErdTable, ProjectData } from '../types/index.ts';

type Plain = Record<string, unknown>;
type WithId = Plain & { id: string };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isPlain = (value: unknown): value is Plain => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasIds = (list: unknown[]): list is WithId[] => list.every((item) => isPlain(item) && typeof item.id === 'string');
const isPrimitive = (value: unknown) => value === null || typeof value !== 'object';

const mergeById = (base: WithId[], local: WithId[], remote: WithId[]): WithId[] => {
  const baseMap = new Map(base.map((item) => [item.id, item]));
  const remoteMap = new Map(remote.map((item) => [item.id, item]));
  const result: WithId[] = [];
  for (const item of local) {
    const before = baseMap.get(item.id);
    const theirs = remoteMap.get(item.id);
    if (!before) result.push(theirs ? (merge3(item, item, theirs) as WithId) : item);
    else if (theirs) result.push(merge3(before, item, theirs) as WithId);
    // [협업 상태] 팀원이 지운 항목은 내가 고치지 않았을 때만 지운다. 고쳤다면 내 편집을 남긴다.
    else if (!same(before, item)) result.push(item);
  }
  const localIds = new Set(local.map((item) => item.id));
  remote.forEach((item, index) => {
    if (localIds.has(item.id)) return;
    const before = baseMap.get(item.id);
    // [협업 상태] 내가 지운 항목은 팀원이 그 사이 고친 경우에만 되살린다.
    if (before && same(before, item)) return;
    // [협업 상태] 팀원 화면과 같은 순서가 되도록 팀원 목록에서 바로 앞 항목 뒤에 넣는다.
    const after = result.findIndex((entry) => entry.id === remote[index - 1]?.id);
    result.splice(index === 0 ? 0 : after === -1 ? result.length : after + 1, 0, item);
  });
  return result;
};

/**
 * [협업 상태] 공통 조상(base)에서 갈라진 내 편집(local)과 팀원 저장본(remote)을 합친다.
 * 한쪽만 바꾼 값은 그쪽을, 둘 다 바꾼 같은 값은 내 편집을 고른다. id 배열은 항목별로, 객체는 필드별로 합친다.
 */
export const merge3 = (base: unknown, local: unknown, remote: unknown): unknown => {
  if (same(local, base) || same(local, remote)) return remote;
  if (same(remote, base)) return local;
  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    if (hasIds(base) && hasIds(local) && hasIds(remote)) return mergeById(base, local, remote);
    // [협업 상태] 태그·투표자 같은 값 목록은 집합으로 합친다(양쪽의 추가·삭제를 모두 반영).
    if ([base, local, remote].every((list) => list.every(isPrimitive))) {
      const removed = base.filter((value) => !remote.some((other) => same(other, value)));
      const added = remote.filter((value) => !base.some((other) => same(other, value)) && !local.some((other) => same(other, value)));
      return [...local.filter((value) => !removed.some((other) => same(other, value))), ...added];
    }
    return local;
  }
  if (isPlain(base) && isPlain(local) && isPlain(remote)) {
    const result: Plain = {};
    for (const key of new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base)])) {
      const value = merge3(base[key], local[key], remote[key]);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  return local;
};

/**
 * [협업 상태] FK는 "table.column" 이름으로 저장된다. 한쪽이 이름을 바꾸는 동안 다른 쪽이 옛 이름으로 FK를 만들면
 * 합친 결과의 참조가 깨지므로, 어느 버전에서든 그 이름을 썼던 테이블·컬럼을 id로 찾아 최종 이름으로 다시 쓴다.
 */
const repointReferences = (versions: ErdTable[][], tables: ErdTable[]): ErdTable[] => {
  // [협업 상태] 합친 결과의 이름을 먼저 찾아서, 새 테이블이 옛 이름을 물려받은 경우 새 테이블을 가리킨다.
  const all = [tables, ...versions];
  const lower = (name: string) => name.trim().toLowerCase();
  const tableId = (name: string) => all.map((v) => v.find((t) => lower(t.name) === name)?.id).find(Boolean);
  const columnId = (id: string, name: string) =>
    all.map((v) => v.find((t) => t.id === id)?.columns.find((c) => lower(c.name) === name)?.id).find(Boolean);
  return tables.map((table) => ({
    ...table,
    columns: table.columns.map((col) => {
      if (!col.isForeignKey || !col.references) return col;
      const [refTable = '', refColumn = ''] = col.references.split('.').map(lower);
      const id = tableId(refTable);
      const target = tables.find((t) => t.id === id);
      const targetColumn = id ? target?.columns.find((c) => c.id === columnId(id, refColumn)) : undefined;
      if (!target || !targetColumn) return col;
      const next = `${target.name}.${targetColumn.name}`;
      return lower(next) === lower(col.references) ? col : { ...col, references: next };
    }),
  }));
};

/** [협업 상태] 프로젝트 문서를 합치고, 한쪽이 지운 노드를 가리키게 된 연결선을 정리한다. */
export const mergeProject = (base: ProjectData, local: ProjectData, remote: ProjectData): ProjectData => {
  const merged = merge3(base, local, remote) as ProjectData;
  const nodeIds = new Set(merged.nodes.map((node) => node.id));
  const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((item) => [item.id, item]));
  const [baseIdeas, localIdeas, remoteIdeas] = [byId(base.ideas), byId(local.ideas), byId(remote.ideas)];
  return {
    ...merged,
    connections: merged.connections.filter((c) => nodeIds.has(c.sourceId) && nodeIds.has(c.targetId)),
    tables: repointReferences([base.tables, local.tables, remote.tables], merged.tables),
    // [협업 상태] 둘 다 투표를 바꿨으면 투표 수를 합쳐진 투표자 목록의 증감에 맞춘다(같은 사람의 중복 투표 방지).
    ideas: merged.ideas.map((idea) => {
      const [before, mine, theirs] = [baseIdeas.get(idea.id), localIdeas.get(idea.id), remoteIdeas.get(idea.id)];
      const untouched = (side: typeof before) => side!.votes === before!.votes && same(side!.votedBy, before!.votedBy);
      if (!before || !mine || !theirs || untouched(mine) || untouched(theirs)) return idea;
      return { ...idea, votes: Math.max(0, before.votes + idea.votedBy.length - before.votedBy.length) };
    }),
  };
};
