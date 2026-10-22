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
  features: view.payload.features,
  nodes: view.payload.nodes,
  connections: view.payload.connections,
  tables: view.payload.tables,
  archVersions: view.payload.archVersions ?? [],
  currentArchVersionId: view.payload.currentArchVersionId,
  updatedAt: view.updatedAt,
});

/** [문서 저장] 공유 필드만 담는다. currentStep 같은 화면 상태는 개인별로 둔다(02 VIEW 02). */
export const toPayload = (project: ProjectData): DocumentPayload => ({
  schemaVersion: 1,
  ideas: project.ideas,
  features: project.features,
  nodes: project.nodes,
  connections: project.connections,
  tables: project.tables,
  stepLocks: project.stepLocks,
  archVersions: project.archVersions,
  ...(project.currentArchVersionId ? { currentArchVersionId: project.currentArchVersionId } : {}),
});

export const toSaveBody = (project: ProjectData, baseVersion: number, mutationId: string): SaveDocumentBody => ({
  baseVersion,
  mutationId,
  project: {
    title: project.title,
    summary: project.summary,
    categoryTag: project.categoryTag,
    targetDbms: project.targetDbms,
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
