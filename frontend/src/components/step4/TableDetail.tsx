import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ErdColumn, ErdTable, FeatureSpec, SqlDialect } from '../../types/index.ts';
import { featureCodeOf } from '../../utils/features.ts';
import { findReferences } from '../../utils/erdRename.ts';
import { ColumnTable } from './ColumnTable.tsx';

const TABLE_NAME = /^[a-z_][a-z0-9_]{0,63}$/;

interface TableDetailProps {
  table: ErdTable;
  tables: ErdTable[];
  targetDbms: SqlDialect;
  features: FeatureSpec[];
  isLocked: boolean;
  onRenameTable: (id: string, name: string) => void;
  onUpdateTable: (id: string, updated: Partial<ErdTable>) => void;
  onDeleteTable: (id: string) => void;
  onAddNewColumn: (tableId: string) => void;
  onUpdateColumn: (tableId: string, colId: string, updated: Partial<ErdColumn>) => void;
  onDeleteColumn: (tableId: string, colId: string) => void;
}

export const TableDetail: React.FC<TableDetailProps> = ({
  table: selectedTable,
  tables,
  targetDbms,
  features,
  isLocked,
  onRenameTable,
  onUpdateTable,
  onDeleteTable,
  onAddNewColumn,
  onUpdateColumn,
  onDeleteColumn,
}) => {
  // [ERD 설계] 테이블 이름 변경 초안: 적용 전에 영향받는 FK를 먼저 보여준다(02 ERD 03).
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  useEffect(() => setRenameDraft(null), [selectedTable.id]);
  const renameRefs = findReferences(tables, selectedTable.name);
  const renameError =
    renameDraft === null
      ? ''
      : !TABLE_NAME.test(renameDraft)
        ? '소문자·숫자·밑줄 64자 이하로 입력하세요.'
        : tables.some((t) => t.id !== selectedTable.id && t.name.toLowerCase() === renameDraft)
          ? '같은 이름의 테이블이 있습니다.'
          : '';
  const submitRename = () => {
    if (isLocked || renameDraft === null || renameError) return;
    if (renameDraft !== selectedTable.name) onRenameTable(selectedTable.id, renameDraft);
    setRenameDraft(null);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* [ERD 설계] 선택한 테이블 정보 */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {renameDraft === null ? (
              <>
                <span className="text-xs font-bold text-white font-mono">{selectedTable.name}</span>
                <span className="text-[11px] text-slate-400">({selectedTable.comment})</span>
                {!isLocked && (
                  <button
                    onClick={() => setRenameDraft(selectedTable.name)}
                    className="text-[10px] text-indigo-300 hover:text-indigo-200 underline-offset-2 hover:underline"
                  >
                    이름 변경
                  </button>
                )}
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitRename();
                }}
                className="flex items-center gap-1"
              >
                <input
                  autoFocus
                  aria-label="새 테이블 이름"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value.toLowerCase())}
                  onKeyDown={(e) => e.key === 'Escape' && setRenameDraft(null)}
                  className="w-36 rounded border border-indigo-500 bg-slate-950 px-1.5 py-0.5 font-mono text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isLocked || !!renameError}
                  className="rounded bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-50"
                >
                  변경
                </button>
                <button type="button" onClick={() => setRenameDraft(null)} className="text-[11px] text-slate-400 hover:text-white">
                  취소
                </button>
              </form>
            )}
          </div>

          {!isLocked && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onAddNewColumn(selectedTable.id)}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-[11px] font-semibold flex items-center gap-1 border border-slate-700"
              >
                <Plus className="w-3 h-3" />
                <span>컬럼 추가</span>
              </button>

              {tables.length > 1 && (
                <button
                  onClick={() => onDeleteTable(selectedTable.id)}
                  className="text-slate-600 hover:text-rose-400 p-1"
                  title="테이블 삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {renameDraft !== null && (
          <div role="status" className="rounded border border-indigo-800/60 bg-indigo-950/40 px-2 py-1.5 text-[11px] text-indigo-200">
            {renameError ? (
              <span className="text-rose-300">{renameError}</span>
            ) : renameRefs.length === 0 ? (
              <span>이 테이블을 참조하는 FK가 없습니다.</span>
            ) : (
              <>
                <span className="font-semibold">함께 바뀌는 FK {renameRefs.length}개</span>
                <ul className="mt-0.5 font-mono text-[10px] text-indigo-300">
                  {renameRefs.map((ref) => (
                    <li key={ref.columnId}>
                      {ref.tableName}.{ref.columnName}: {selectedTable.name}.… → {renameDraft}.…
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {/* [ERD 설계] 관련 기능 태그 */}
        <label className="flex items-center gap-2 text-[10px] text-slate-400">
          테이블 설명
          <input aria-label="테이블 설명" disabled={isLocked} value={selectedTable.comment}
            onChange={(event) => onUpdateTable(selectedTable.id, { comment: event.target.value })}
            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200" />
        </label>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-500 font-medium">연관 기능(추적):</span>
          {features.map((feature) => <label key={feature.id} className="flex items-center gap-1 text-[10px] text-slate-300">
            <input type="checkbox" aria-label={`${featureCodeOf(features, feature.id)} 기능 연결`} disabled={isLocked}
              checked={selectedTable.relatedFeatureIds.includes(feature.id)} onChange={(event) => onUpdateTable(selectedTable.id, {
                relatedFeatureIds: event.target.checked ? [...new Set([...selectedTable.relatedFeatureIds, feature.id])]
                  : selectedTable.relatedFeatureIds.filter((id) => id !== feature.id),
              })} />{featureCodeOf(features, feature.id)}
          </label>)}
          {selectedTable.relatedFeatureIds.length === 0 ? (
            <span className="text-[10px] text-amber-500/80 italic">연결된 기능 없음 (Linter 주의)</span>
          ) : (
            selectedTable.relatedFeatureIds.map((featId) => (
              <span
                key={featId}
                className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50"
              >
                {featureCodeOf(features, featId)}
              </span>
            ))
          )}
        </div>
      </div>

      {/* [ERD 설계] 컬럼 표 */}
      <ColumnTable
        targetDbms={targetDbms}
        table={selectedTable}
        tables={tables}
        isLocked={isLocked}
        onUpdateColumn={onUpdateColumn}
        onDeleteColumn={onDeleteColumn}
      />
    </div>
  );
};
