import { request } from './client.ts';
import { authClient } from './auth.ts';
import type {
  DocumentPayload,
  ChatMessage,
  DocumentView,
  PresenceEntry,
  ProjectMemberInfo,
  ProjectSummary,
  SessionUser,
  SqlDialect,
} from '../types/index.ts';

export interface SaveDocumentBody {
  baseVersion: number;
  mutationId: string;
  project: { title: string; summary: string; categoryTag: string; targetDbms: SqlDialect };
  payload: DocumentPayload;
}

export interface SaveDocumentResult {
  version: number;
  updatedAt: string;
  mutationId: string;
  replayed: boolean;
  // [문서 저장] 서버가 정규화한 저장본. 재전송 응답(replayed)에는 없을 수 있다.
  project?: ProjectSummary;
  payload?: DocumentPayload;
}

/** [로그인] 리프레시 쿠키가 있으면 액세스 토큰을 새로 받아 로그인 상태를 복구한다. */
export const fetchMe = (): Promise<SessionUser> => authClient.me();

export const loginWithPassword = (loginId: string, password: string): Promise<SessionUser> =>
  authClient.login(loginId, password);

/** [구글 로그인] 공개 가입은 토큰 발급 없이 계정만 생성한다. */
export const registerAccount = async (body: { loginId: string; displayName: string; password: string; email?: string }): Promise<SessionUser> =>
  (await request<{ user: SessionUser }>('POST', '/api/auth/register', body)).data!.user;

export const fetchAuthOptions = async (): Promise<{ googleEnabled: boolean }> => {
  const data = (await request<{ google: { enabled: boolean } }>('GET', '/api/auth/options')).data!;
  return { googleEnabled: data.google.enabled };
};

/** [구글 로그인] 서버가 만든 구글 인증 주소. 로그인 후 /auth/callback으로 돌아오며 리프레시 쿠키가 설정된다. */
export const startGoogleLogin = async (): Promise<string> =>
  (await request<{ authorizationUrl: string }>('POST', '/api/auth/google/start', {})).data!.authorizationUrl;

/** [구글 로그인] 서버가 현재 계정의 비밀번호를 확인한 뒤 명시 연결을 시작한다. */
export const startGoogleLink = async (password: string): Promise<string> =>
  (await request<{ authorizationUrl: string }>('POST', '/api/auth/google/link/start', { password })).data!.authorizationUrl;

export const logout = (): Promise<void> => authClient.logout();

/** [구글 로그인] 인증메일 없이 현재 계정의 비밀번호를 다시 확인하고 주소를 직접 저장한다. */
export const saveEmail = async (email: string, password: string): Promise<string> =>
  (await request<{ email: string }>('POST', '/api/auth/email', { email, password })).data!.email;

export const listProjects = async (includeArchived = false): Promise<ProjectSummary[]> =>
  (await request<ProjectSummary[]>('GET', `/api/projects${includeArchived ? '?archived=all' : ''}`)).data!;

/** [프로젝트] 기존 보관 API를 사용하며 복원해도 초대 코드를 임의로 바꾸지 않는다. */
export const setProjectArchived = async (id: string, archived: boolean): Promise<ProjectSummary> =>
  (await request<ProjectSummary>('PATCH', `/api/projects/${id}/archive`, { archived })).data!;

export const createProject = async (title: string, summary: string, categoryTag = ''): Promise<ProjectSummary> =>
  (await request<ProjectSummary>('POST', '/api/projects', { title, summary, categoryTag })).data!;

export const cloneProject = async (id: string, sourceVersion: number, title: string): Promise<ProjectSummary> =>
  (await request<ProjectSummary>('POST', `/api/projects/${id}/clone`, { sourceVersion, title })).data!;

/** [문서 저장] 이미 가진 버전이라 서버가 304로 답하면 null을 돌려준다. */
export const fetchDocument = async (id: string, knownVersion?: number): Promise<DocumentView | null> => {
  const headers: Record<string, string> = knownVersion ? { 'If-None-Match': `"${id}:${knownVersion}"` } : {};
  const response = await request<DocumentView>('GET', `/api/projects/${id}/document`, undefined, headers);
  return response.status === 304 ? null : response.data!;
};

export const saveDocument = async (id: string, body: SaveDocumentBody): Promise<SaveDocumentResult> =>
  (await request<SaveDocumentResult>('PUT', `/api/projects/${id}/document`, body)).data!;

export interface ProjectActivity {
  eventId: string;
  projectId: string;
  version: number;
  actorId: string;
  actorName: string;
  committedAt: string;
  changes: { area: string; action: string; label?: string; entityType?: string; entityId?: string }[];
}

export interface ProjectDashboardData {
  projectId: string;
  version: number;
  counts: Record<'ideas' | 'features' | 'nodes' | 'connections' | 'tables', number>;
  featureStatuses: Record<string, number>;
  progress: number;
  recentActivity: ProjectActivity[];
}

/** [협업 상태] 진행도와 최근 활동은 한 서버 저장 버전의 집계로 표시한다. */
export const fetchDashboard = async (id: string): Promise<ProjectDashboardData> =>
  (await request<ProjectDashboardData>('GET', `/api/projects/${id}/dashboard`)).data!;

export const fetchActivity = async (id: string, beforeVersion: number): Promise<{ items: ProjectActivity[]; nextBeforeVersion: number | null }> =>
  (await request<{ items: ProjectActivity[]; nextBeforeVersion: number | null }>('GET', `/api/projects/${id}/activity?beforeVersion=${beforeVersion}&limit=20`)).data!;

/** [초대 코드] 팀장만 받는다. 코드가 없던 기존 프로젝트는 이때 만들어진다. */
export const fetchInviteCode = async (id: string): Promise<string> =>
  (await request<{ code: string }>('GET', `/api/projects/${id}/invite`)).data!.code;

export const regenerateInviteCode = async (id: string): Promise<string> =>
  (await request<{ code: string }>('POST', `/api/projects/${id}/invite`)).data!.code;

/** [초대 코드] 팀장에게 받은 코드로 편집자로 참가한다. */
export const joinProject = async (code: string): Promise<ProjectSummary> =>
  (await request<ProjectSummary>('POST', '/api/projects/join', { code })).data!;

/** [채팅] since가 있으면 그 시각 이후(같은 시각 포함) 메시지만 받는다. */
export const fetchMessages = async (id: string, since = '1970-01-01T00:00:00Z', afterId?: string): Promise<ChatMessage[]> =>
  (await request<ChatMessage[]>('GET', `/api/projects/${id}/messages?since=${encodeURIComponent(since)}${afterId ? `&afterId=${encodeURIComponent(afterId)}` : ''}`)).data!;

export const sendMessage = async (id: string, body: string, messageId?: string): Promise<ChatMessage> =>
  (await request<ChatMessage>('POST', `/api/projects/${id}/messages`, { body, ...(messageId ? { messageId } : {}) })).data!;

// [협업 상태] 같은 계정으로 탭을 여러 개 열어도 한 탭을 닫을 때 다른 탭의 접속 표시가 지워지지 않도록 탭마다 구분한다.
const TAB_ID = crypto.randomUUID();

/** [협업 상태] 내 접속을 알리고 지금 접속한 멤버 목록을 받는다. */
export const sendPresence = async (id: string, step: number): Promise<PresenceEntry[]> =>
  (await request<PresenceEntry[]>('POST', `/api/projects/${id}/presence`, { step, tabId: TAB_ID })).data!;

export const leavePresence = async (id: string): Promise<void> => {
  await request('DELETE', `/api/projects/${id}/presence?tabId=${TAB_ID}`);
};

// [멤버 관리] 서버는 사용자 ID를 id로 준다. 화면은 userId를 쓴다.
export const listMembers = async (id: string): Promise<ProjectMemberInfo[]> =>
  (await request<(Omit<ProjectMemberInfo, 'userId'> & { id: string })[]>('GET', `/api/projects/${id}/members`)).data!
    .map(({ id: userId, ...member }) => ({ ...member, userId }));
