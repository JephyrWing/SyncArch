export type StepNumber = 1 | 2 | 3 | 4;

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  badge: 'BE' | 'FE' | 'Lead';
  color: string;
  avatarBg: string;
  currentStep: StepNumber;
  isSpotlight: boolean;
  // [협업 상태] 지금 이 프로젝트 화면을 열어 둔 멤버
  isOnline?: boolean;
}

export type IdeaCategory = 'problems_goals' | 'actors' | 'user_stories' | 'constraints';
export type DecisionStatus = 'ACCEPTED' | 'REVIEW' | 'DEFERRED' | 'REJECTED';

export interface IdeaComment {
  id: string;
  // 서버가 확정한 작성자 ID와 UTC 시각을 사용하고 기존 표시 이름은 호환합니다.
  authorId?: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface IdeaCard {
  id: string;
  // v2 저장 계약입니다. 펼침·선택 상태는 공유 문서에 넣지 않습니다.
  parentIdeaId?: string | null;
  siblingOrder?: number;
  authorId?: string;
  voterIds?: string[];
  category: IdeaCategory;
  title: string;
  description: string;
  author: string;
  votes: number;
  votedBy: string[];
  comments: IdeaComment[];
  isAiDraft?: boolean;
  // [아이디어 보드] 이 아이디어를 낸 이유(배경 / 가설)
  rationale?: string;
  // [아이디어 보드] 이 아이디어를 채택·선택한 이유(결정 기록)
  decisionStatus?: DecisionStatus;
  decisionReason?: string;
  decidedBy?: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type PriorityLevel = 'P0' | 'P1' | 'P2';
export type FeatureProgressStatus = 'PLANNED' | 'IN_PROGRESS' | 'QA' | 'COMPLETED';

export interface FeatureSpec {
  id: string; // [기능 명세] 예: FEAT-01
  displayCode?: string;
  domain: string;
  name: string;
  priority: PriorityLevel;
  assignee: string;
  method: HttpMethod;
  endpoint: string;
  requestFields: string;
  responseFields: string;
  summary: string;
  status: FeatureProgressStatus;
  responseStatusCodes?: string[];
  relatedStoryId?: string;
  isAiDraft?: boolean;
}

export type ArchCategory = 'Client' | 'Service' | 'DataStore' | 'Messaging' | 'Infra';
export type ArchProtocol = 'REST' | 'gRPC' | 'WebSocket' | 'Pub/Sub' | 'SQL' | 'Redis' | 'Kafka';
export type TeamOrg = 'All' | 'Frontend' | 'Backend' | 'Infra' | 'Common';

export interface ArchNode {
  id: string;
  category: ArchCategory;
  name: string;
  techStack: string[];
  x: number;
  y: number;
  description: string;
  assignedTeam?: 'Frontend' | 'Backend' | 'Infra' | 'Common';
  isAiDraft?: boolean;
}

export interface ArchConnection {
  id: string;
  sourceId: string;
  targetId: string;
  protocol: ArchProtocol;
  label?: string;
  description?: string;
}

export interface ArchVersion {
  id: string;
  versionNumber: string;
  label: string;
  description: string;
  createdAt: string;
  nodes: ArchNode[];
  connections: ArchConnection[];
}

export interface ErdColumn {
  id: string;
  name: string;
  dataType: string;
  // 문자·바이너리·BIT 길이, DECIMAL/시간 정밀도는 서버가 자료형과 분리해 저장합니다.
  length?: number;
  precision?: number;
  scale?: number;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: string; // [ERD 설계] 예: "users.id"
  isUnique: boolean;
  isNullable: boolean;
  defaultValue?: string;
  comment: string;
  relatedFeatureId?: string;
}

export interface ErdTable {
  id: string;
  name: string;
  comment: string;
  relatedFeatureIds: string[];
  columns: ErdColumn[];
  x: number;
  y: number;
  isAiDraft?: boolean;
}

export interface SnapshotHistory {
  id: string;
  name: string;
  timestamp: number;
  dateStr: string;
}

export type SqlDialect = 'postgres' | 'mysql' | 'mariadb' | 'oracle' | 'mssql' | 'sqlite' | 'prisma';

export interface ExportSettings {
  dialect: SqlDialect;
  includeDropTable: boolean;
  includeForeignKeys: boolean;
  includeIndexes: boolean;
  includeComments: boolean;
}

export interface LinterIssue {
  id: string;
  type: 'missing_fk_index' | 'orphan_table' | 'broken_fk_ref' | 'feature_missing_table';
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  tableId?: string;
  tableName?: string;
  columnId?: string;
  columnName?: string;
  autoFixType?: 'create_index' | 'connect_table' | 'map_feature';
}

export interface ProjectData {
  id: string;
  title: string;
  summary: string;
  categoryTag: string;
  targetDbms: SqlDialect;
  currentStep: StepNumber;
  stepLocks: Record<StepNumber, boolean>;
  ideas: IdeaCard[];
  features: FeatureSpec[];
  nodes: ArchNode[];
  connections: ArchConnection[];
  archVersions: ArchVersion[];
  currentArchVersionId?: string;
  tables: ErdTable[];
  updatedAt: string;
  // [문서 저장] 서버가 읽기 전용으로 보존하는 호환 필드의 원본. 저장할 때 이 값을 그대로 돌려보낸다.
  compat?: Pick<DocumentPayload, 'stepLocks' | 'archVersions' | 'currentArchVersionId'>;
}

// [API 통신] 서버 API 형태(02 설계 API 정의서). 공유 문서 payload에는 개인 화면 상태를 넣지 않는다.
export interface SessionUser {
  id: string;
  loginId: string;
  displayName: string;
}

export type ProjectRole = 'OWNER' | 'EDITOR';

export interface ProjectSummary {
  id: string;
  title: string;
  summary: string;
  categoryTag: string;
  targetDbms: SqlDialect;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: ProjectRole;
}

export interface DocumentPayload {
  schemaVersion: 1;
  ideas: IdeaCard[];
  features: FeatureSpec[];
  nodes: ArchNode[];
  connections: ArchConnection[];
  tables: ErdTable[];
  stepLocks?: Record<StepNumber, boolean>;
  archVersions?: ArchVersion[];
  currentArchVersionId?: string;
}

export interface DocumentView {
  project: ProjectSummary;
  version: number;
  payload: DocumentPayload;
  updatedAt: string;
  updatedBy?: { id: string; displayName: string };
}

// [채팅] GET/POST /api/projects/{id}/messages 항목
export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  body: string;
  createdAt: string;
}

// [채팅] 다음 조회 기준. 마지막으로 받은 메시지의 시각과 id다.
export type ChatCursor = Pick<ChatMessage, 'createdAt' | 'id'>;

// [협업 상태] POST /api/projects/{id}/presence 응답 항목
export interface PresenceEntry {
  userId: string;
  displayName: string;
  step: StepNumber;
}

export interface ProjectMemberInfo {
  userId: string;
  loginId: string;
  displayName: string;
  role: ProjectRole;
  joinedAt: string;
}
