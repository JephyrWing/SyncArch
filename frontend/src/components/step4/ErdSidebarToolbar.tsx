import React from 'react';
import { Database, FileCode, Plus, Settings2 } from 'lucide-react';
import type { SqlDialect } from '../../types/index.ts';
import { DBMS_NAMES } from './erdConfig.ts';

interface ErdSidebarToolbarProps {
  tableCount: number;
  isLocked: boolean;
  targetDbms: SqlDialect;
  onSelectDbms: (dbms: SqlDialect) => void;
  onOpenSqlPreview: () => void;
  onOpenAddTable: () => void;
}

export const ErdSidebarToolbar: React.FC<ErdSidebarToolbarProps> = ({
  tableCount,
  isLocked,
  targetDbms,
  onSelectDbms,
  onOpenSqlPreview,
  onOpenAddTable,
}) => (
  <div className="p-3 border-b border-slate-800 bg-slate-900/90 shrink-0 space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
          <Database className="w-4 h-4" />
          Step 4. DB(ERD) 테이블 및 컬럼 설계
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">총 {tableCount}개 테이블 정의됨</div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenSqlPreview}
          className="px-2.5 py-1 bg-sky-950 hover:bg-sky-900 border border-sky-700/60 text-sky-300 rounded text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
          title="선택한 DBMS 맞춤 DDL 쿼리 즉시 미리보기"
        >
          <FileCode className="w-3.5 h-3.5 text-sky-400" />
          <span>SQL 미리보기</span>
        </button>

        {!isLocked && (
          <button
            onClick={onOpenAddTable}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>테이블 추가</span>
          </button>
        )}
      </div>
    </div>

    {/* [ERD 설계] 대상 DBMS 선택 바 */}
    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 text-xs">
      <span className="font-semibold text-slate-400 flex items-center gap-1 shrink-0">
        <Settings2 className="w-3 h-3 text-sky-400" /> 대상 DBMS:
      </span>

      <div className="flex flex-wrap items-center justify-end gap-1">
        {(Object.keys(DBMS_NAMES) as SqlDialect[]).map((d) => (
          <button
            key={d}
            onClick={() => onSelectDbms(d)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all shrink-0 ${
              targetDbms === d
                ? 'bg-sky-600 text-white shadow-sm ring-1 ring-sky-400'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {DBMS_NAMES[d].badge}
          </button>
        ))}
      </div>
    </div>
  </div>
);
