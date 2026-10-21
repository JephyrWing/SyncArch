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
  // Why this idea was proposed (Background / Hypothesis)
  rationale?: string;
  // Why this idea was accepted or chosen (Decision log)
  decisionStatus?: DecisionStatus;
  decisionReason?: string;
  decidedBy?: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type PriorityLevel = 'P0' | 'P1' | 'P2';
export type FeatureProgressStatus = 'PLANNED' | 'IN_PROGRESS' | 'QA' | 'COMPLETED';

export interface FeatureSpec {
  id: string; // e.g. FEAT-01
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
  // VARCHAR 길이, DECIMAL/DATETIME 정밀도는 자료형과 분리해 저장합니다.
  length?: number;
  precision?: number;
  scale?: number;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: string; // e.g. "users.id"
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
}
