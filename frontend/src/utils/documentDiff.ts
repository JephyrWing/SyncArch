import type { DocumentPayload } from '../types/index.ts';

export interface DocumentChange {
  area: string;
  name: string;
  kind: '추가' | '수정' | '이동' | '삭제';
}

type Item = { id: string; [key: string]: unknown };

// [협업 상태] 연결선은 라벨이 비어 있는 경우가 많아서 양 끝 노드 이름으로 부른다.
const nodeName = (docs: DocumentPayload[], id: unknown) =>
  docs.flatMap((doc) => doc.nodes).find((node) => node.id === id)?.name ?? '?';

const AREAS: { key: keyof Omit<DocumentPayload, 'schemaVersion' | 'stepLocks' | 'archVersions' | 'currentArchVersionId'>; label: string; nameOf: (item: Item, docs: DocumentPayload[]) => string }[] = [
  { key: 'ideas', label: '아이디어', nameOf: (item) => String(item.title ?? item.id) },
  { key: 'features', label: '기능', nameOf: (item) => String(item.name ?? item.id) },
  { key: 'nodes', label: '시스템', nameOf: (item) => String(item.name ?? item.id) },
  { key: 'connections', label: '연결선', nameOf: (item, docs) => String(item.label || `${nodeName(docs, item.sourceId)} → ${nodeName(docs, item.targetId)}`) },
  { key: 'tables', label: 'ERD', nameOf: (item) => String(item.name ?? item.id) },
];

const withoutPosition = ({ x, y, ...rest }: Item) => rest;

/** [협업 상태] 저장된 두 버전 사이의 항목 단위 변경. 이름은 바뀔 수 있어서 id로 맞춘다. */
export const diffPayload = (before: DocumentPayload | null, after: DocumentPayload): DocumentChange[] => {
  if (!before) return [];
  const changes: DocumentChange[] = [];
  const docs = [after, before];
  for (const { key, label, nameOf: name } of AREAS) {
    const nameOf = (item: Item) => name(item, docs);
    const oldItems = new Map((before[key] as unknown as Item[]).map((item) => [item.id, item]));
    const newItems = after[key] as unknown as Item[];
    for (const item of newItems) {
      const previous = oldItems.get(item.id);
      if (!previous) changes.push({ area: label, name: nameOf(item), kind: '추가' });
      else if (JSON.stringify(previous) !== JSON.stringify(item)) {
        const moved = JSON.stringify(withoutPosition(previous)) === JSON.stringify(withoutPosition(item));
        changes.push({ area: label, name: nameOf(item), kind: moved ? '이동' : '수정' });
      }
      oldItems.delete(item.id);
    }
    for (const removed of oldItems.values()) changes.push({ area: label, name: nameOf(removed), kind: '삭제' });
  }
  return changes;
};

/** [협업 상태] 예: "맹동영님이 ERD 'orders' 항목을 수정했습니다 (외 2건) · v8" */
export const describeChanges = (actor: string, changes: DocumentChange[], version: number): string => {
  if (changes.length === 0) return `${actor}님이 프로젝트 정보를 저장했습니다 · v${version}`;
  const [first] = changes;
  const more = changes.length > 1 ? ` (외 ${changes.length - 1}건)` : '';
  return `${actor}님이 ${first.area} '${first.name}' 항목을 ${first.kind}했습니다${more} · v${version}`;
};
