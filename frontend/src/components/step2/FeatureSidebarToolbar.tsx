import React from 'react';
import { Download, FileCode, FileSpreadsheet, Plus, TrendingUp } from 'lucide-react';
import type { FeatureProgressStatus, TeamMember } from '../../types/index.ts';

interface FeatureSidebarToolbarProps {
  featureCount: number;
  isLocked: boolean;
  onOpenApiDoc: () => void;
  /** [API 명세 엑셀] 서버가 마지막 저장본으로 만드는 .xlsx 주소 */
  excelUrl?: string;
  onToggleAddForm: () => void;
  progressPercent: number;
  totalCount: number;
  completedCount: number;
  qaCount: number;
  inProgressCount: number;
  plannedCount: number;
  filterStatus: FeatureProgressStatus | 'ALL';
  onChangeFilterStatus: (status: FeatureProgressStatus | 'ALL') => void;
  filterAssignee: string;
  onChangeFilterAssignee: (assignee: string) => void;
  teamMembers: TeamMember[];
}

export const FeatureSidebarToolbar: React.FC<FeatureSidebarToolbarProps> = ({
  featureCount,
  isLocked,
  onOpenApiDoc,
  excelUrl,
  onToggleAddForm,
  progressPercent,
  totalCount,
  completedCount,
  qaCount,
  inProgressCount,
  plannedCount,
  filterStatus,
  onChangeFilterStatus,
  filterAssignee,
  onChangeFilterAssignee,
  teamMembers,
}) => (
  <div className="p-3 border-b border-slate-800 bg-slate-900/90 shrink-0 space-y-2">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
          <FileSpreadsheet className="w-4 h-4" />
          Step 2. 기능 명세 &amp; API 설계
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">총 {featureCount}개 기능 정의됨</div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* [기능 명세] API 문서 자동 생성 버튼 */}
        <button
          onClick={onOpenApiDoc}
          className="px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
          title="Swagger 3.0 / OpenAPI 형식의 API 명세서 자동 생성 및 추출"
        >
          <FileCode className="w-3.5 h-3.5 text-sky-400" />
          <span>API 명세서 자동화</span>
        </button>

        {/* [API 명세 엑셀] 받을 때마다 최신 저장본으로 만든 팀 양식 엑셀 */}
        {excelUrl && (
          <a
            href={excelUrl}
            download
            className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            title="마지막으로 저장된 버전의 API 명세를 팀 양식 엑셀(.xlsx)로 받습니다"
          >
            <Download className="w-3.5 h-3.5" />
            <span>엑셀</span>
          </a>
        )}

        {!isLocked && (
          <button
            onClick={onToggleAddForm}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>기능 추가</span>
          </button>
        )}
      </div>
    </div>

    {/* [기능 명세] 진행률 막대 */}
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

      {/* [기능 명세] 상태별 구간 진행률 막대 */}
      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
        <div style={{ width: `${(completedCount / (totalCount || 1)) * 100}%` }} className="bg-emerald-500 h-full transition-all duration-300" title="완료됨" />
        <div style={{ width: `${(qaCount / (totalCount || 1)) * 100}%` }} className="bg-purple-500 h-full transition-all duration-300" title="QA 검증" />
        <div style={{ width: `${(inProgressCount / (totalCount || 1)) * 100}%` }} className="bg-sky-500 h-full transition-all duration-300" title="진행중" />
      </div>
    </div>

    {/* [기능 명세] 필터 바: 상태와 담당자 */}
    <div className="flex items-center justify-between gap-2 pt-1 text-[11px] flex-wrap">
      <div className="flex items-center gap-1">
        <span className="text-slate-400 font-medium">상태:</span>
        <select
          value={filterStatus}
          onChange={(e) => onChangeFilterStatus(e.target.value as any)}
          className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white"
        >
          <option value="ALL">전체 ({featureCount})</option>
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
          onChange={(e) => onChangeFilterAssignee(e.target.value)}
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
);
