import type { ArchNode } from '../types/index.ts';

// [시스템 아키텍처] 연결선은 서로 다른, 지금 있는 두 노드만 잇는다(팀원이 그 사이 노드를 지웠을 수 있다).
export const isValidConnection = (nodes: ArchNode[], sourceId: string, targetId: string) =>
  sourceId !== targetId && nodes.some((n) => n.id === sourceId) && nodes.some((n) => n.id === targetId);

// [시스템 아키텍처] 편집 모달은 연 시점 값과 달라진 필드만 보낸다. 그 사이 팀원이 바꾼 다른 필드를 되돌리지 않기 위해서다.
export const changedFields = <T extends object>(opened: T, edited: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(edited).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(opened[key as keyof T])),
  ) as Partial<T>;
