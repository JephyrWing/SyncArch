import { request, setCsrfToken } from './client.ts';
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
}

export const fetchMe = async (): Promise<SessionUser> =>
  (await request<{ user: SessionUser }>('GET', '/api/auth/me')).data!.user;

/** [구글 로그인] 백엔드가 내려주는 구글 OAuth 클라이언트 ID(GOOGLE_CLIENT_ID가 없으면 빈 값). */
export const fetchGoogleClientId = async (): Promise<string> => {
  const data = (await request<{ csrfToken: string; googleClientId: string }>('GET', '/api/auth/csrf')).data!;
  setCsrfToken(data.csrfToken);
  return data.googleClientId;
};

/** [구글 로그인] 구글 버튼이 준 ID 토큰을 서버 세션으로 바꾼다. */
export const loginWithGoogle = async (credential: string): Promise<SessionUser> => {
  const data = (await request<{ user: SessionUser; csrfToken: string }>('POST', '/api/auth/login', { credential })).data!;
  // [구글 로그인] 서버가 새 세션용 CSRF 토큰을 새로 발급한다.
  setCsrfToken(data.csrfToken);
  return data.user;
};

export const logout = async (): Promise<void> => {
  await request('POST', '/api/auth/logout');
  setCsrfToken('');
};

export const listProjects = async (): Promise<ProjectSummary[]> =>
  (await request<ProjectSummary[]>('GET', '/api/projects')).data!;

export const createProject = async (title: string, summary: string): Promise<ProjectSummary> =>
  (await request<ProjectSummary>('POST', '/api/projects', { title, summary })).data!;

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

/** [초대 코드] 팀장만 받는다. 코드가 없던 기존 프로젝트는 이때 만들어진다. */
export const fetchInviteCode = async (id: string): Promise<string> =>
  (await request<{ code: string }>('GET', `/api/projects/${id}/invite`)).data!.code;

export const regenerateInviteCode = async (id: string): Promise<string> =>
  (await request<{ code: string }>('POST', `/api/projects/${id}/invite`)).data!.code;

/** [초대 코드] 팀장에게 받은 코드로 편집자로 참가한다. */
export const joinProject = async (code: string): Promise<ProjectSummary> =>
  (await request<ProjectSummary>('POST', '/api/projects/join', { code })).data!;

/** [채팅] since가 있으면 그 시각 이후(같은 시각 포함) 메시지만 받는다. */
export const fetchMessages = async (id: string, since?: string): Promise<ChatMessage[]> =>
  (await request<ChatMessage[]>('GET', `/api/projects/${id}/messages${since ? `?since=${encodeURIComponent(since)}` : ''}`)).data!;

export const sendMessage = async (id: string, body: string): Promise<ChatMessage> =>
  (await request<ChatMessage>('POST', `/api/projects/${id}/messages`, { body })).data!;

/** [협업 상태] 내 접속을 알리고 지금 접속한 멤버 목록을 받는다. */
export const sendPresence = async (id: string, step: number): Promise<PresenceEntry[]> =>
  (await request<PresenceEntry[]>('POST', `/api/projects/${id}/presence`, { step })).data!;

export const leavePresence = async (id: string): Promise<void> => {
  await request('DELETE', `/api/projects/${id}/presence`);
};

export const listMembers = async (id: string): Promise<ProjectMemberInfo[]> =>
  (await request<ProjectMemberInfo[]>('GET', `/api/projects/${id}/members`)).data!;
