import React from 'react';
import { Lightbulb, Lock } from 'lucide-react';

interface IdeaSidebarHeaderProps {
  projectSummary: string;
  onUpdateSummary: (summary: string) => void;
  isLocked: boolean;
  acceptedCount: number;
  reviewCount: number;
  deferredCount: number;
}

export const IdeaSidebarHeader: React.FC<IdeaSidebarHeaderProps> = ({
  projectSummary,
  onUpdateSummary,
  isLocked,
  acceptedCount,
  reviewCount,
  deferredCount,
}) => (
  <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
        <Lightbulb className="w-4 h-4" />
        Step 1. 아이디어 &amp; 의사결정 (Why &amp; Decision)
      </span>
      {isLocked && (
        <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-600/30">
          <Lock className="w-3 h-3" /> 잠금 활성
        </span>
      )}
    </div>

    {/* [아이디어 보드] 프로젝트 요약 입력 */}
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-slate-400">프로젝트 한 줄 정의</label>
      <input
        type="text"
        disabled={isLocked}
        value={projectSummary}
        onChange={(e) => onUpdateSummary(e.target.value)}
        placeholder="예: 사내 스터디 매칭 & 출석 관리 플랫폼"
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
      />
    </div>

    {/* [아이디어 보드] 결정 현황 요약 */}
    <div className="mt-2.5 p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px]">
      <span className="text-slate-400">의사결정 현황:</span>
      <div className="flex items-center gap-2 font-mono text-[10px]">
        <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-600/30">
          채택 {acceptedCount}
        </span>
        <span className="text-amber-400 font-bold bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-600/30">
          검토 {reviewCount}
        </span>
        <span className="text-slate-400 font-medium bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
          보류 {deferredCount}
        </span>
      </div>
    </div>
  </div>
);
