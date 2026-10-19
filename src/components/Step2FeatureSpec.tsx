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
  Sparkles, 
  Lock,
  Workflow,
  CheckCircle2,
  GitBranch
} from 'lucide-react';
import type { FeatureSpec, HttpMethod, PriorityLevel, TeamMember, IdeaCard } from '../types/index.ts';

interface Step2FeatureSpecProps {
  features: FeatureSpec[];
  onAddFeature: (feature: Omit<FeatureSpec, 'id'>) => void;
  onUpdateFeature: (id: string, updated: Partial<FeatureSpec>) => void;
  onDeleteFeature: (id: string) => void;
  onImportFromStep1: () => void;
  ideas: IdeaCard[];
  teamMembers: TeamMember[];
  isLocked: boolean;
  onTriggerAiDraft: () => void;
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

export const Step2FeatureSpec: React.FC<Step2FeatureSpecProps> = ({
  features,
  onAddFeature,
  onUpdateFeature,
  onDeleteFeature,
  onImportFromStep1,
  ideas,
  teamMembers,
  isLocked,
  onTriggerAiDraft,
}) => {
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>(features[0]?.id || '');
  const [showAddForm, setShowAddForm] = useState(false);

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

  const highVoteCardsCount = ideas.filter((i) => i.votes >= 4).length;

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
    });

    setNewName('');
    setNewReq('');
    setNewRes('');
    setNewSummary('');
    setShowAddForm(false);
  };

  const selectedFeature = features.find((f) => f.id === selectedFeatureId) || features[0];

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950">
      {/* LEFT PANEL: 42% Feature Spec Grid & Keyboard Editor */}
      <div className="w-[42%] border-r border-slate-800 bg-slate-900/70 flex flex-col h-full overflow-hidden shrink-0">
        {/* Header Action Bar */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4" />
              Step 2. 기능 명세 및 API 설계
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">총 {features.length}개 기능 및 API 정의됨</div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Import from Step 1 high votes */}
            <button
              onClick={onImportFromStep1}
              disabled={isLocked || highVoteCardsCount === 0}
              className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-40"
              title="Step 1에서 4표 이상 획득한 아이디어를 에픽 기능으로 자동 변환"
            >
              <Download className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">다득표 에픽 가져오기 ({highVoteCardsCount})</span>
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

        {/* Add Feature Modal / Form Accordion */}
        {showAddForm && (
          <div className="p-3 border-b border-slate-800 bg-slate-950/90 animate-in fade-in duration-100 shrink-0">
            <form onSubmit={handleCreateSubmit} className="space-y-2.5">
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

              <div className="grid grid-cols-3 gap-2">
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
                  placeholder="예: 실시간 QR 출석 검증"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-1">
                  <label className="text-[10px] text-slate-400">HTTP Method</label>
                  <select
                    value={newMethod}
                    onChange={(e) => setNewMethod(e.target.value as HttpMethod)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] text-slate-400">Endpoint Path</label>
                  <input
                    type="text"
                    value={newEndpoint}
                    onChange={(e) => setNewEndpoint(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">Request 핵심 필드</label>
                  <input
                    type="text"
                    placeholder="token: string, id: UUID"
                    value={newReq}
                    onChange={(e) => setNewReq(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-slate-300"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Response 핵심 필드</label>
                  <input
                    type="text"
                    placeholder="success: boolean, status: string"
                    value={newRes}
                    onChange={(e) => setNewRes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-xs font-semibold"
                >
                  등록 완료
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Features Table / List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
          {features.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">등록된 기능 명세가 없습니다.</div>
          ) : (
            features.map((feat) => {
              const isSelected = selectedFeatureId === feat.id;
              const methodMeta = METHOD_COLORS[feat.method];
              const pMeta = PRIORITY_BADGES[feat.priority];

              return (
                <div
                  key={feat.id}
                  onClick={() => setSelectedFeatureId(feat.id)}
                  className={`p-3 cursor-pointer transition-colors group ${
                    isSelected ? 'bg-indigo-950/40 border-l-2 border-indigo-500' : 'hover:bg-slate-800/50'
                  } ${feat.isAiDraft ? 'ring-1 ring-inset ring-indigo-500/30' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-indigo-300">{feat.id}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                        {feat.domain}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded border ${pMeta.bg} ${pMeta.border} ${pMeta.text}`}>
                        {feat.priority}
                      </span>
                      {feat.isAiDraft && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-600/40">
                          AI 초안
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">{feat.assignee}</span>
                      {!isLocked && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFeature(feat.id);
                          }}
                          className="text-slate-600 hover:text-rose-400 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-slate-100 mb-1.5">{feat.name}</div>

                  {/* API Badges */}
                  <div className="flex items-center gap-1.5 text-[11px] font-mono mb-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${methodMeta.bg} ${methodMeta.border} ${methodMeta.text}`}>
                      {feat.method}
                    </span>
                    <span className="text-slate-300 truncate">{feat.endpoint}</span>
                  </div>

                  {/* Schema fields */}
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 truncate">
                    <span className="text-sky-400">REQ:</span> {feat.requestFields}
                    <span className="text-slate-600">|</span>
                    <span className="text-emerald-400">RES:</span> {feat.responseFields}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL: 58% User Flow & API Sequence Diagram Canvas */}
      <div className="w-[58%] flex flex-col h-full bg-slate-950/60 overflow-hidden">
        {/* Canvas Toolbar */}
        <div className="h-10 px-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold text-slate-200">인터랙티브 유저 플로우 &amp; API 시퀀스 다이어그램</span>
          </div>
          <button
            onClick={onTriggerAiDraft}
            className="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            <span>AI API 명세 보완</span>
          </button>
        </div>

        {/* Visual Flow Canvas */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {/* User Entry Node */}
          <div className="flex items-center justify-center">
            <div className="px-4 py-2 rounded-full bg-slate-900 border-2 border-indigo-500/50 text-xs font-bold text-indigo-300 shadow-lg shadow-indigo-500/10 flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>클라이언트 웹 / 모바일 앱 진입</span>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="w-0.5 h-6 bg-slate-800" />
          </div>

          {/* Sequential Feature Calling Cards */}
          <div className="space-y-4 max-w-2xl mx-auto">
            {features.map((feat, index) => {
              const isSelected = selectedFeatureId === feat.id;
              const methodMeta = METHOD_COLORS[feat.method];
              const pMeta = PRIORITY_BADGES[feat.priority];

              return (
                <div key={feat.id} className="relative">
                  {index > 0 && (
                    <div className="flex justify-center -mt-4 mb-2">
                      <div className="w-0.5 h-6 bg-gradient-to-b from-indigo-500/40 to-slate-800" />
                    </div>
                  )}

                  <div
                    onClick={() => setSelectedFeatureId(feat.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/30 shadow-xl'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/40">
                          {feat.id}
                        </span>
                        <span className="text-xs font-bold text-white">{feat.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded border ${pMeta.bg} ${pMeta.border} ${pMeta.text}`}>
                          {feat.priority}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">담당: {feat.assignee}</span>
                    </div>

                    {/* Endpoint Pill */}
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800/80 mb-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${methodMeta.bg} ${methodMeta.border} ${methodMeta.text}`}>
                        {feat.method}
                      </span>
                      <span className="text-xs font-mono text-slate-200">{feat.endpoint}</span>
                    </div>

                    {/* Request / Response Mock Visual */}
                    <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                      <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
                        <div className="text-[10px] font-semibold text-sky-400 mb-1">Request Payload</div>
                        <div className="text-slate-300 break-all">{feat.requestFields}</div>
                      </div>
                      <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
                        <div className="text-[10px] font-semibold text-emerald-400 mb-1">Response Data</div>
                        <div className="text-slate-300 break-all">{feat.responseFields}</div>
                      </div>
                    </div>

                    <div className="mt-2.5 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{feat.summary}</span>
                      {feat.relatedStoryId && (
                        <span className="text-[10px] text-indigo-400 bg-indigo-950/50 px-1.5 py-0.5 rounded">
                          🔗 Step 1 연계됨
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
