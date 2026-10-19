import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  ArrowRight, 
  Download, 
  Trash2, 
  Filter, 
  Globe, 
  Code2, 
  Lock,
  Workflow,
  CheckCircle2,
  GitBranch,
  FileCode,
  Copy,
  Check,
  X,
  ListTodo,
  TrendingUp,
  Terminal,
  Play,
  Layers,
  Send,
  FileText,
  LayoutList,
  LayoutGrid
} from 'lucide-react';
import type { FeatureSpec, HttpMethod, PriorityLevel, FeatureProgressStatus, TeamMember, IdeaCard } from '../types/index.ts';

interface Step2FeatureSpecProps {
  features: FeatureSpec[];
  onAddFeature: (feature: Omit<FeatureSpec, 'id'>) => void;
  onUpdateFeature: (id: string, updated: Partial<FeatureSpec>) => void;
  onDeleteFeature: (id: string) => void;
  onImportFromStep1: () => void;
  ideas: IdeaCard[];
  teamMembers: TeamMember[];
  isLocked: boolean;
  sidebarWidth: number;
  onStartResize: (e: React.MouseEvent) => void;
  mobileTab: 'editor' | 'canvas';
  onChangeMobileTab: (tab: 'editor' | 'canvas') => void;
  isDesktop?: boolean;
}

const METHOD_COLORS: Record<HttpMethod, { text: string; bg: string; border: string }> = {
  GET: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  POST: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
  PUT: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  PATCH: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  DELETE: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
};

const PRIORITY_BADGES: Record<PriorityLevel, { text: string; bg: string; border: string }> = {
  P0: { text: 'text-rose-300 font-bold', bg: 'bg-rose-950/80', border: 'border-rose-600/50' },
  P1: { text: 'text-amber-300 font-bold', bg: 'bg-amber-950/80', border: 'border-amber-600/50' },
  P2: { text: 'text-slate-300 font-medium', bg: 'bg-slate-800', border: 'border-slate-700' },
};

const STATUS_BADGES: Record<FeatureProgressStatus, { label: string; text: string; bg: string; border: string }> = {
  PLANNED: { label: '계획', text: 'text-slate-300', bg: 'bg-slate-800', border: 'border-slate-700' },
  IN_PROGRESS: { label: '진행중', text: 'text-sky-300 font-semibold', bg: 'bg-sky-950/80', border: 'border-sky-600/40' },
  QA: { label: 'QA 검증', text: 'text-purple-300 font-semibold', bg: 'bg-purple-950/80', border: 'border-purple-600/40' },
  COMPLETED: { label: '완료됨', text: 'text-emerald-300 font-bold', bg: 'bg-emerald-950/80', border: 'border-emerald-600/40' },
};

export const Step2FeatureSpec: React.FC<Step2FeatureSpecProps> = ({
  features,
  onAddFeature,
  onUpdateFeature,
  onDeleteFeature,
  onImportFromStep1,
  ideas,
  teamMembers,
  isLocked,
  sidebarWidth,
  onStartResize,
  mobileTab,
  onChangeMobileTab,
  isDesktop = true,
}) => {
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>(features[0]?.id || '');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showApiDocModal, setShowApiDocModal] = useState(false);
  const [apiDocTab, setApiDocTab] = useState<'swagger_json' | 'swagger_yaml' | 'markdown'>('swagger_json');
  const [copiedDoc, setCopiedDoc] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState<FeatureProgressStatus | 'ALL'>('ALL');
  const [filterAssignee, setFilterAssignee] = useState<string>('ALL');

  // Interactive Mock Tester State
  const [testResponseStatus, setTestResponseStatus] = useState<number | null>(null);
  const [testResponseBody, setTestResponseBody] = useState<string | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);

  // New feature form state
  const [newDomain, setNewDomain] = useState('스터디 관리');
  const [newName, setNewName] = useState('');
  const [newPriority, setNewPriority] = useState<PriorityLevel>('P0');
  const [newAssignee, setNewAssignee] = useState(teamMembers[0]?.name || '현우');
  const [newMethod, setNewMethod] = useState<HttpMethod>('POST');
  const [newEndpoint, setNewEndpoint] = useState('/api/v1/');
  const [newReq, setNewReq] = useState('');
  const [newRes, setNewRes] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newStatus, setNewStatus] = useState<FeatureProgressStatus>('PLANNED');

  const highVoteCardsCount = ideas.filter((i) => i.votes >= 4).length;

  // Calculate Overall Progress
  const totalCount = features.length;
  const completedCount = features.filter((f) => f.status === 'COMPLETED').length;
  const inProgressCount = features.filter((f) => f.status === 'IN_PROGRESS').length;
  const qaCount = features.filter((f) => f.status === 'QA').length;
  const plannedCount = totalCount - completedCount - inProgressCount - qaCount;
  const progressPercent = totalCount > 0 ? Math.round(((completedCount * 1.0 + qaCount * 0.75 + inProgressCount * 0.4) / totalCount) * 100) : 0;

  const filteredFeatures = features.filter((f) => {
    if (filterStatus !== 'ALL' && f.status !== filterStatus) return false;
    if (filterAssignee !== 'ALL' && f.assignee !== filterAssignee) return false;
    return true;
  });

  const selectedFeature = features.find((f) => f.id === selectedFeatureId) || filteredFeatures[0] || features[0];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || isLocked) return;

    onAddFeature({
      domain: newDomain.trim() || '공통',
      name: newName.trim(),
      priority: newPriority,
      assignee: newAssignee,
      method: newMethod,
      endpoint: newEndpoint.trim(),
      requestFields: newReq.trim() || 'None',
      responseFields: newRes.trim() || '{ success: boolean }',
      summary: newSummary.trim() || newName.trim(),
      status: newStatus,
      responseStatusCodes: ['200 OK', '400 Bad Request', '401 Unauthorized', '500 Server Error'],
    });

    setNewName('');
    setNewReq('');
    setNewRes('');
    setNewSummary('');
    setShowAddForm(false);
  };

  // Generate OpenAPI / Swagger 3.0 specification JSON
  const generateOpenApiJson = () => {
    const paths: Record<string, any> = {};

    features.forEach((f) => {
      const methodKey = f.method.toLowerCase();
      if (!paths[f.endpoint]) {
        paths[f.endpoint] = {};
      }
      paths[f.endpoint][methodKey] = {
        summary: f.name,
        description: f.summary,
        tags: [f.domain],
        parameters: [],
        requestBody: f.method !== 'GET' ? {
          description: 'Request Payload',
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                example: f.requestFields,
              },
            },
          },
        } : undefined,
        responses: {
          '200': {
            description: '성공 응답',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  example: f.responseFields,
                },
              },
            },
          },
          '400': { description: '잘못된 요청 파라미터' },
          '401': { description: '인증 토큰 누락 또는 유효하지 않음' },
          '500': { description: '서버 내부 오류' },
        },
      };
    });

    return JSON.stringify({
      openapi: '3.0.3',
      info: {
        title: 'SyncArch Auto-generated API Documentation',
        version: '1.0.0',
        description: 'SyncArch에서 자동 추출된 REST API 명세서 (Swagger 3.0 호환)',
      },
      paths,
    }, null, 2);
  };

  // Generate OpenAPI YAML format
  const generateOpenApiYaml = () => {
    const lines: string[] = [
      'openapi: 3.0.3',
      'info:',
      '  title: SyncArch Auto-generated API Documentation',
      '  version: 1.0.0',
      '  description: SyncArch에서 자동 생성된 REST API 명세서',
      'paths:',
    ];

    features.forEach((f) => {
      lines.push(`  ${f.endpoint}:`);
      lines.push(`    ${f.method.toLowerCase()}:`);
      lines.push(`      summary: "${f.name}"`);
      lines.push(`      description: "${f.summary}"`);
      lines.push(`      tags: ["${f.domain}"]`);
      if (f.method !== 'GET') {
        lines.push('      requestBody:');
        lines.push('        required: true');
        lines.push('        content:');
        lines.push('          application/json:');
        lines.push('            schema:');
        lines.push('              type: object');
      }
      lines.push('      responses:');
      lines.push("        '200':");
      lines.push('          description: "성공 응답"');
      lines.push("        '400':");
      lines.push('          description: "잘못된 요청"');
      lines.push("        '500':");
      lines.push('          description: "서버 내부 오류"');
    });

    return lines.join('\n');
  };

  // Generate Markdown API Table
  const generateMarkdownTable = () => {
    const lines: string[] = [
      '# API 명세서 (자동 추출)',
      '',
      `| 도메인 | 메서드 | 엔드포인트 | 기능명 | 우선순위 | 진행상황 | 담당자 |`,
      `|:---|:---:|:---|:---|:---:|:---:|:---:|`,
    ];

    features.forEach((f) => {
      lines.push(`| ${f.domain} | **${f.method}** | \`${f.endpoint}\` | ${f.name} | ${f.priority} | ${STATUS_BADGES[f.status].label} | ${f.assignee} |`);
    });

    lines.push('', '## 엔드포인트별 상세 입출력 명세', '');
    features.forEach((f) => {
      lines.push(`### [${f.method}] ${f.endpoint} - ${f.name}`);
      lines.push(`- **설명**: ${f.summary}`);
      lines.push(`- **요청 파라미터**: \`${f.requestFields}\``);
      lines.push(`- **응답 필드**: \`${f.responseFields}\``);
      lines.push('');
    });

    return lines.join('\n');
  };

  const handleTestMockApi = () => {
    if (!selectedFeature) return;
    setIsTestingApi(true);
    setTestResponseStatus(null);
    setTestResponseBody(null);

    setTimeout(() => {
      setIsTestingApi(false);
      setTestResponseStatus(200);
      setTestResponseBody(
        JSON.stringify(
          {
            status: 200,
            message: `${selectedFeature.name} mock 호출이 성공적으로 처리되었습니다.`,
            endpoint: selectedFeature.endpoint,
            method: selectedFeature.method,
            timestamp: new Date().toISOString(),
            mockData: {
              assignee: selectedFeature.assignee,
              featureId: selectedFeature.id,
              result: 'SUCCESS',
            },
          },
          null,
          2
        )
      );
    }, 400);
  };

  const currentDocContent = 
    apiDocTab === 'swagger_json' ? generateOpenApiJson() :
    apiDocTab === 'swagger_yaml' ? generateOpenApiYaml() :
    generateMarkdownTable();

  const handleCopyDoc = () => {
    navigator.clipboard.writeText(currentDocContent);
    setCopiedDoc(true);
    setTimeout(() => setCopiedDoc(false), 2000);
  };

  const handleDownloadDoc = () => {
    let filename = 'openapi-spec.json';
    let mime = 'application/json';
    if (apiDocTab === 'swagger_yaml') {
      filename = 'openapi-spec.yaml';
      mime = 'text/yaml';
    } else if (apiDocTab === 'markdown') {
      filename = 'API_SPECIFICATION.md';
      mime = 'text/markdown';
    }

    const blob = new Blob([currentDocContent], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      {/* Mobile / Tablet Segmented View Switcher */}
      <div className="lg:hidden flex items-center justify-center p-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full max-w-sm">
          <button
            onClick={() => onChangeMobileTab('editor')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              mobileTab === 'editor'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" />
            <span>기능 목록 &amp; 진행상황</span>
          </button>
          <button
            onClick={() => onChangeMobileTab('canvas')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              mobileTab === 'canvas'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>API 상세 &amp; 시퀀스</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: Resizable Feature Spec Grid & Progress Dashboard */}
        <div 
          style={{ width: isDesktop ? `${sidebarWidth}%` : '100%' }}
          className={`border-r border-slate-800 bg-slate-900/70 flex flex-col h-full overflow-hidden shrink-0 ${
            mobileTab === 'editor' ? 'w-full flex' : 'hidden lg:flex'
          }`}
        >
          {/* Header Action Bar */}
          <div className="p-3 border-b border-slate-800 bg-slate-900/90 shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4" />
                  Step 2. 기능 명세 &amp; API 설계
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">총 {features.length}개 기능 정의됨</div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Automated API Docs Trigger */}
                <button
                  onClick={() => setShowApiDocModal(true)}
                  className="px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                  title="Swagger 3.0 / OpenAPI 형식의 API 명세서 자동 생성 및 추출"
                >
                  <FileCode className="w-3.5 h-3.5 text-sky-400" />
                  <span>API 명세서 자동화</span>
                </button>

                {!isLocked && (
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>기능 추가</span>
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar Widget */}
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-slate-200 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  전체 구현 진행상황: <strong className="text-emerald-400 font-mono text-sm">{progressPercent}%</strong>
                </span>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="text-emerald-400 font-bold">완료 {completedCount}</span>
                  <span className="text-purple-400 font-bold">QA {qaCount}</span>
                  <span className="text-sky-400 font-bold">진행 {inProgressCount}</span>
                  <span className="text-slate-400 font-medium">계획 {plannedCount}</span>
                </div>
              </div>

              {/* Segmented Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
                <div style={{ width: `${(completedCount / (totalCount || 1)) * 100}%` }} className="bg-emerald-500 h-full transition-all duration-300" title="완료됨" />
                <div style={{ width: `${(qaCount / (totalCount || 1)) * 100}%` }} className="bg-purple-500 h-full transition-all duration-300" title="QA 검증" />
                <div style={{ width: `${(inProgressCount / (totalCount || 1)) * 100}%` }} className="bg-sky-500 h-full transition-all duration-300" title="진행중" />
              </div>
            </div>

            {/* Filters Bar: Status and Assignee */}
            <div className="flex items-center justify-between gap-2 pt-1 text-[11px] flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-medium">상태:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white"
                >
                  <option value="ALL">전체 ({features.length})</option>
                  <option value="PLANNED">계획 ({plannedCount})</option>
                  <option value="IN_PROGRESS">진행중 ({inProgressCount})</option>
                  <option value="QA">QA 검증 ({qaCount})</option>
                  <option value="COMPLETED">완료됨 ({completedCount})</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-medium">담당자:</span>
                <select
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white"
                >
                  <option value="ALL">전체</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.badge})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Add Feature Modal / Form Accordion */}
          {showAddForm && (
            <div className="p-3 border-b border-slate-800 bg-slate-950/90 animate-in fade-in duration-100 shrink-0">
              <form onSubmit={handleCreateSubmit} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span>신규 기능 &amp; API 엔드포인트 등록</span>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-slate-500 hover:text-slate-300 text-[11px]"
                  >
                    닫기
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">도메인</label>
                    <input
                      type="text"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">우선순위</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="P0">P0 (필수)</option>
                      <option value="P1">P1 (주요)</option>
                      <option value="P2">P2 (부가)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">진행상황</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as FeatureProgressStatus)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="PLANNED">계획</option>
                      <option value="IN_PROGRESS">진행중</option>
                      <option value="QA">QA 검증</option>
                      <option value="COMPLETED">완료됨</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">담당자</label>
                    <select
                      value={newAssignee}
                      onChange={(e) => setNewAssignee(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    >
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.name}>
                          {m.name} ({m.badge})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400">기능명</label>
                  <input
                    type="text"
                    placeholder="예: 실시간 QR 출석 체크"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">HTTP 메서드</label>
                    <select
                      value={newMethod}
                      onChange={(e) => setNewMethod(e.target.value as HttpMethod)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-400">엔드포인트 경로</label>
                    <input
                      type="text"
                      value={newEndpoint}
                      onChange={(e) => setNewEndpoint(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Request Fields</label>
                    <input
                      type="text"
                      placeholder="study_id: UUID, code: string"
                      value={newReq}
                      onChange={(e) => setNewReq(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Response Fields</label>
                    <input
                      type="text"
                      placeholder="attendance_id: UUID, status: string"
                      value={newRes}
                      onChange={(e) => setNewRes(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
                  >
                    기능 등록
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Features Table List with Quick Status Switch */}
          <div className="flex-1 overflow-y-auto">
            {filteredFeatures.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                조건에 일치하는 기능 명세가 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {filteredFeatures.map((f) => {
                  const isSelected = selectedFeature?.id === f.id;
                  const mColor = METHOD_COLORS[f.method];
                  const pColor = PRIORITY_BADGES[f.priority];
                  const sColor = STATUS_BADGES[f.status];

                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFeatureId(f.id)}
                      className={`p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-slate-800/90 border-l-4 border-indigo-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-bold text-slate-400">{f.id}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-bold ${mColor.bg} ${mColor.text} ${mColor.border}`}>
                            {f.method}
                          </span>
                          <span className={`text-[9px] px-1 py-0.2 rounded border ${pColor.bg} ${pColor.text} ${pColor.border}`}>
                            {f.priority}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400">[{f.domain}]</span>
                        </div>

                        {/* Quick Status Dropdown */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <select
                            disabled={isLocked}
                            value={f.status}
                            onChange={(e) => onUpdateFeature(f.id, { status: e.target.value as FeatureProgressStatus })}
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border focus:outline-none cursor-pointer ${sColor.bg} ${sColor.text} ${sColor.border}`}
                          >
                            <option value="PLANNED">계획</option>
                            <option value="IN_PROGRESS">진행중</option>
                            <option value="QA">QA 검증</option>
                            <option value="COMPLETED">완료됨</option>
                          </select>

                          {!isLocked && (
                            <button
                              onClick={() => onDeleteFeature(f.id)}
                              className="text-slate-600 hover:text-rose-400 p-0.5"
                              title="기능 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-xs font-semibold text-slate-200">{f.name}</div>
                      <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">{f.endpoint}</div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                        <span>담당: <strong className="text-slate-300">{f.assignee}</strong></span>
                        <span className="truncate max-w-[200px] text-slate-400">{f.summary}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 1 Epic Importer Banner */}
          <div className="p-3 bg-indigo-950/40 border-t border-slate-800 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-slate-300">
                Step 1 고득표(4표 이상) 아이디어: <strong className="text-indigo-300">{highVoteCardsCount}건</strong>
              </span>
            </div>
            <button
              onClick={onImportFromStep1}
              disabled={highVoteCardsCount === 0 || isLocked}
              className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 disabled:opacity-40 border border-indigo-500/40 text-indigo-200 rounded text-[11px] font-bold flex items-center gap-1 transition-colors"
            >
              <ArrowRight className="w-3 h-3" />
              <span>기능으로 자동 임포트</span>
            </button>
          </div>
        </div>

        {/* Resizer Divider between Left and Right Panel */}
        <div
          onMouseDown={onStartResize}
          className="hidden lg:flex w-1.5 hover:w-2 bg-slate-800 hover:bg-indigo-500 cursor-col-resize transition-all items-center justify-center shrink-0 group z-10 select-none"
          title="드래그하여 사이드바 너비 조절"
        >
          <div className="w-0.5 h-8 bg-slate-600 group-hover:bg-white rounded-full transition-colors" />
        </div>

        {/* RIGHT PANEL: API Detail & Interactive Sequence Flow Canvas */}
        <div 
          style={{ width: isDesktop ? `${100 - sidebarWidth}%` : '100%' }}
          className={`flex-col h-full bg-slate-950/60 overflow-hidden ${
            mobileTab === 'canvas' ? 'w-full flex' : 'hidden lg:flex'
          }`}
        >
          {selectedFeature ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header info */}
              <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0 flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold border ${METHOD_COLORS[selectedFeature.method].bg} ${METHOD_COLORS[selectedFeature.method].text} ${METHOD_COLORS[selectedFeature.method].border}`}>
                      {selectedFeature.method}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white font-mono break-all">{selectedFeature.endpoint}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${STATUS_BADGES[selectedFeature.status].bg} ${STATUS_BADGES[selectedFeature.status].text} ${STATUS_BADGES[selectedFeature.status].border}`}>
                      {STATUS_BADGES[selectedFeature.status].label}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1">{selectedFeature.name}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestMockApi}
                    disabled={isTestingApi}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                  >
                    <Play className={`w-3.5 h-3.5 ${isTestingApi ? 'animate-spin' : ''}`} />
                    <span>Mock API 테스트</span>
                  </button>
                </div>
              </div>

              {/* API Spec Content */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
                {/* Parameters / Payloads Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-sky-400">
                      <span className="flex items-center gap-1">
                        <Code2 className="w-3.5 h-3.5" /> Request Payload (Schema)
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">application/json</span>
                    </div>
                    <pre className="p-2.5 bg-slate-950 rounded-lg text-xs font-mono text-slate-200 border border-slate-800 whitespace-pre-wrap overflow-x-auto">
                      {selectedFeature.requestFields}
                    </pre>
                  </div>

                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                      <span className="flex items-center gap-1">
                        <Code2 className="w-3.5 h-3.5" /> Response Payload (Schema)
                      </span>
                      <span className="text-[10px] text-emerald-500 font-mono">200 OK</span>
                    </div>
                    <pre className="p-2.5 bg-slate-950 rounded-lg text-xs font-mono text-slate-200 border border-slate-800 whitespace-pre-wrap overflow-x-auto">
                      {selectedFeature.responseFields}
                    </pre>
                  </div>
                </div>

                {/* Mock Test Result Panel if tested */}
                {testResponseStatus && (
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-emerald-500/40 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Mock API 호출 결과 (Status: 200 OK)
                      </span>
                      <button onClick={() => setTestResponseStatus(null)} className="text-slate-400 hover:text-white">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <pre className="p-2 bg-slate-950 rounded text-xs font-mono text-emerald-300 border border-slate-800 whitespace-pre-wrap overflow-x-auto">
                      {testResponseBody}
                    </pre>
                  </div>
                )}

                {/* Sequence Flow Diagram (Visual Canvas) */}
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Workflow className="w-4 h-4 text-indigo-400" />
                      엔드투엔드 API Sequence Flow 다이어그램
                    </span>
                    <span className="text-[11px] text-slate-500 hidden sm:inline">클라이언트 → 게이트웨이 → 서비스 → DB</span>
                  </div>

                  {/* SVG Visual Flow */}
                  <div className="h-44 bg-slate-950 rounded-lg border border-slate-800 relative flex items-center justify-around px-4 sm:px-6 overflow-x-auto">
                    {/* Lifeline 1: Client */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="px-2.5 py-1 rounded bg-sky-950 border border-sky-600/50 text-sky-300 text-xs font-bold">
                        Web/Mobile
                      </div>
                      <div className="w-0.5 h-24 bg-slate-700/60 my-1" />
                    </div>

                    {/* Lifeline 2: API Gateway */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="px-2.5 py-1 rounded bg-indigo-950 border border-indigo-600/50 text-indigo-300 text-xs font-bold">
                        API Gateway
                      </div>
                      <div className="w-0.5 h-24 bg-slate-700/60 my-1" />
                    </div>

                    {/* Lifeline 3: Service Core */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="px-2.5 py-1 rounded bg-purple-950 border border-purple-600/50 text-purple-300 text-xs font-bold">
                        Backend Service
                      </div>
                      <div className="w-0.5 h-24 bg-slate-700/60 my-1" />
                    </div>

                    {/* Lifeline 4: Database */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="px-2.5 py-1 rounded bg-emerald-950 border border-emerald-600/50 text-emerald-300 text-xs font-bold">
                        Database (DB)
                      </div>
                      <div className="w-0.5 h-24 bg-slate-700/60 my-1" />
                    </div>

                    {/* Flow Arrows overlay */}
                    <div className="absolute inset-x-8 sm:inset-x-12 top-20 flex flex-col gap-3 pointer-events-none text-[10px] font-mono">
                      <div className="flex items-center text-sky-400">
                        <span className="bg-slate-900 px-1 rounded border border-slate-700 mr-1 truncate max-w-[120px] sm:max-w-none">{selectedFeature.method} {selectedFeature.endpoint}</span>
                        <div className="flex-1 border-t-2 border-sky-500 border-dashed relative">
                          <span className="absolute right-0 -top-1.5">▶</span>
                        </div>
                      </div>
                      <div className="flex items-center text-emerald-400 pl-16 sm:pl-24">
                        <span className="bg-slate-900 px-1 rounded border border-slate-700 mr-1">SQL Query</span>
                        <div className="flex-1 border-t-2 border-emerald-500 relative">
                          <span className="absolute right-0 -top-1.5">▶</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
              좌측 목록에서 기능을 선택하거나 신규 기능을 추가하세요.
            </div>
          )}
        </div>
      </div>

      {/* Automated API Docs Modal */}
      {showApiDocModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col h-[85vh] overflow-hidden text-slate-100">
            {/* Modal Header */}
            <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">자동화된 API 명세서</h4>
                  <p className="text-[11px] text-slate-400">
                    Swagger 3.0 / OpenAPI 스펙 및 Markdown API 테이블 실시간 생성
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setApiDocTab('swagger_json')}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    apiDocTab === 'swagger_json' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Swagger JSON
                </button>
                <button
                  onClick={() => setApiDocTab('swagger_yaml')}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    apiDocTab === 'swagger_yaml' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Swagger YAML
                </button>
                <button
                  onClick={() => setApiDocTab('markdown')}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    apiDocTab === 'markdown' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Markdown 명세서
                </button>
              </div>

              <button
                onClick={() => setShowApiDocModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Doc Preview Code Box */}
            <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs text-slate-200">
              <pre className="whitespace-pre-wrap leading-relaxed select-text font-mono">
                {currentDocContent}
              </pre>
            </div>

            {/* Bottom Actions */}
            <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-400 font-mono">
                총 {features.length}개 엔드포인트 명세 반영
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyDoc}
                  className="px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {copiedDoc ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDoc ? '복사 완료' : '클립보드 복사'}</span>
                </button>

                <button
                  onClick={handleDownloadDoc}
                  className="px-3 sm:px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>다운로드</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
