import type {
  DocumentPayload,
  DocumentView,
  ProjectData,
  ProjectMemberInfo,
  StepNumber,
  TeamMember,
} from '../types/index.ts';
import type { SaveDocumentBody } from '../api/projects.ts';

const DEFAULT_LOCKS: Record<StepNumber, boolean> = { 1: false, 2: false, 3: false, 4: false };

/** [문서 저장] 서버 문서를 기존 Step 화면 4개가 쓰는 ProjectData 형태로 바꾼다. */
export const toProjectData = (view: DocumentView, currentStep: StepNumber): ProjectData => ({
  id: view.project.id,
  title: view.project.title,
  summary: view.project.summary,
  categoryTag: view.project.categoryTag,
  targetDbms: view.project.targetDbms,
  currentStep,
  stepLocks: view.payload.stepLocks ?? DEFAULT_LOCKS,
  ideas: view.payload.ideas,
  // 서버가 허용하는 최소 문서에도 화면이 필요한 표시 기본값을 제공한다.
  features: view.payload.features.map((feature) => ({
    ...feature,
    domain: feature.domain ?? '', priority: feature.priority ?? 'P1', assignee: feature.assignee ?? '',
    method: feature.method ?? 'GET', endpoint: feature.endpoint ?? '',
    requestFields: feature.requestFields ?? '', responseFields: feature.responseFields ?? '',
    summary: feature.summary ?? '', status: feature.status ?? 'PLANNED',
  })),
  nodes: view.payload.nodes.map((node) => ({
    ...node, techStack: node.techStack ?? [], description: node.description ?? '',
  })),
  connections: view.payload.connections,
  // [ERD 설계] 서버에서 생략 가능한 표시 필드를 채워 API로 만든 최소 문서도 편집할 수 있게 한다.
  tables: view.payload.tables.map((table) => ({
    ...table,
    comment: table.comment ?? '', relatedFeatureIds: table.relatedFeatureIds ?? [], x: table.x ?? 100, y: table.y ?? 100,
    columns: table.columns.map((column) => ({
      ...column,
      isPrimaryKey: column.isPrimaryKey ?? false, isForeignKey: column.isForeignKey ?? false,
      isUnique: column.isUnique ?? false, isNullable: column.isNullable ?? true, comment: column.comment ?? '',
    })),
  })),
  archVersions: view.payload.archVersions ?? [],
  currentArchVersionId: view.payload.currentArchVersionId,
  updatedAt: view.updatedAt,
  compat: Object.fromEntries(
    (['stepLocks', 'archVersions', 'currentArchVersionId'] as const)
      .filter((key) => key in view.payload)
      .map((key) => [key, view.payload[key]])
  ),
});

/** [문서 저장] 공유 필드만 담는다. currentStep 같은 화면 상태는 개인별로 둔다(02 VIEW 02). */
export const toPayload = (project: ProjectData): DocumentPayload => ({
  schemaVersion: 1,
  ideas: project.ideas,
  features: project.features,
  nodes: project.nodes,
  connections: project.connections,
  tables: project.tables,
  // shortcut: 서버 계약은 stepLocks·archVersions·currentArchVersionId 변경을 거절한다(document_validation COMPATIBILITY).
  // Step 잠금과 아키텍처 버전은 이 화면에서만 유지된다. 서버가 저장을 지원하면 project 값을 보내도록 되돌린다.
  ...(project.compat ?? {}),
});

export const toSaveBody = (project: ProjectData, baseVersion: number, mutationId: string): SaveDocumentBody => ({
  baseVersion,
  mutationId,
  project: {
    title: project.title,
    summary: project.summary,
    categoryTag: project.categoryTag,
    // shortcut: 서버 저장 계약은 mariadb만 받는다(project_schema). 다른 DBMS 선택은 이 화면에서만 유지된다. 계약이 넓어지면 project.targetDbms로 되돌린다.
    targetDbms: 'mariadb',
  },
  payload: toPayload(project),
});

const AVATAR_COLORS = [
  ['#3b82f6', 'bg-blue-600'],
  ['#10b981', 'bg-emerald-600'],
  ['#f59e0b', 'bg-amber-600'],
  ['#8b5cf6', 'bg-purple-600'],
  ['#ec4899', 'bg-pink-600'],
];

/** [멤버 관리] 실제 프로젝트 멤버를 헤더와 Step 화면이 쓰는 TeamMember 형태로 바꾼다. */
export const toTeamMembers = (members: ProjectMemberInfo[]): TeamMember[] =>
  members.map((member, index) => {
    const [color, avatarBg] = AVATAR_COLORS[index % AVATAR_COLORS.length];
    // [멤버 관리] 같은 이름의 멤버가 있으면 이메일 앞부분을 붙여 구분한다(예: 같은 사람의 두 구글 계정).
    const namesakes = members.filter((other) => other.userId !== member.userId && other.displayName === member.displayName);
    const local = member.loginId.split('@')[0];
    // [멤버 관리] 이메일 앞부분까지 같으면(alex@gmail.com, alex@company.com) 전체 이메일로 구분한다.
    const tag = namesakes.some((other) => other.loginId.split('@')[0] === local) ? member.loginId : local;
    return {
      id: member.userId,
      name: namesakes.length > 0 ? `${member.displayName} (${tag})` : member.displayName,
      role: member.role === 'OWNER' ? '소유자' : '편집자',
      badge: member.role === 'OWNER' ? 'Lead' : 'BE',
      color,
      avatarBg,
      currentStep: 1,
      isSpotlight: false,
    };
  });
