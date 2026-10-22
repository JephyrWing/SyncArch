import React from 'react';
import { AlertTriangle, CheckCircle, ShieldCheck, Wrench } from 'lucide-react';
import type { LinterIssue, SqlDialect } from '../../types/index.ts';
import { DBMS_NAMES } from './erdConfig.ts';

interface LinterBarProps {
  linterIssues: LinterIssue[];
  isLocked: boolean;
  targetDbms: SqlDialect;
  onApplyAutoFix: (issue: LinterIssue) => void;
}

export const LinterBar: React.FC<LinterBarProps> = ({ linterIssues, isLocked, targetDbms, onApplyAutoFix }) => (
  <div className="h-11 bg-slate-900 border-t border-slate-800 px-4 flex items-center justify-between shrink-0 text-xs text-slate-300 z-20">
    <div className="flex items-center gap-3 overflow-x-auto min-w-0 [scrollbar-width:thin]">
      <div className="flex items-center gap-1.5 font-bold text-slate-200 shrink-0 whitespace-nowrap">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>ERD 무결성 검사</span>
      </div>

      {linterIssues.length === 0 ? (
        <div className="flex items-center gap-1 text-emerald-400 font-medium">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>모든 외래키 인덱스 및 무결성 제약조건이 완벽합니다.</span>
        </div>
      ) : (
        linterIssues.map((issue) => (
          <div
            key={issue.id}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950 border border-amber-600/40 text-[11px] text-amber-300 shrink-0"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate max-w-[280px]">{issue.title}: {issue.message}</span>
            {issue.autoFixType && !isLocked && (
              <button
                onClick={() => onApplyAutoFix(issue)}
                className="ml-1 px-1.5 py-0.2 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-[10px] flex items-center gap-0.5 border border-amber-500/30"
              >
                <Wrench className="w-2.5 h-2.5" />
                <span>원클릭 자동해결</span>
              </button>
            )}
          </div>
        ))
      )}
    </div>

    <div className="hidden sm:block text-[11px] text-slate-500 font-mono shrink-0 pl-2">
      선택 DBMS: <strong className="text-sky-400">{DBMS_NAMES[targetDbms].label}</strong>
    </div>
  </div>
);
