import React from 'react';
import { Trash2 } from 'lucide-react';
import type { ErdColumn, ErdTable } from '../../types/index.ts';
import { findReferences } from '../../utils/erdRename.ts';

interface ColumnTableProps {
  table: ErdTable;
  tables: ErdTable[];
  isLocked: boolean;
  onUpdateColumn: (tableId: string, colId: string, updated: Partial<ErdColumn>) => void;
  onDeleteColumn: (tableId: string, colId: string) => void;
}

export const ColumnTable: React.FC<ColumnTableProps> = ({
  table: selectedTable,
  tables,
  isLocked,
  onUpdateColumn,
  onDeleteColumn,
}) => (
  <div className="flex-1 overflow-auto">
    <table className="w-full text-left text-xs border-collapse">
      <thead className="bg-slate-900/90 text-slate-400 font-medium text-[10px] uppercase tracking-wider sticky top-0 z-10 border-b border-slate-800">
        <tr>
          <th className="p-2 w-7">PK</th>
          <th className="p-2 w-7">FK</th>
          <th className="p-2">컬럼명</th>
          <th className="p-2">데이터 타입</th>
          <th className="p-2 w-12">NULL</th>
          <th className="p-2">설명 / 참조</th>
          <th className="p-2 w-8"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
        {selectedTable.columns.map((col) => (
          <tr key={col.id} className="hover:bg-slate-800/30 transition-colors">
            {/* [ERD 설계] PK 체크박스 */}
            <td className="p-2 text-center">
              <input
                type="checkbox"
                disabled={isLocked}
                checked={col.isPrimaryKey}
                onChange={(e) =>
                  onUpdateColumn(selectedTable.id, col.id, {
                    isPrimaryKey: e.target.checked,
                    isNullable: e.target.checked ? false : col.isNullable,
                  })
                }
                className="rounded border-slate-700 text-indigo-500"
              />
            </td>

            {/* [ERD 설계] FK 체크박스 */}
            <td className="p-2 text-center">
              <input
                type="checkbox"
                disabled={isLocked}
                checked={col.isForeignKey}
                onChange={(e) =>
                  onUpdateColumn(selectedTable.id, col.id, {
                    isForeignKey: e.target.checked,
                  })
                }
                className="rounded border-slate-700 text-sky-500"
              />
            </td>

            {/* [ERD 설계] 컬럼 이름 */}
            <td className="p-2">
              <input
                type="text"
                disabled={isLocked}
                value={col.name}
                onChange={(e) =>
                  onUpdateColumn(selectedTable.id, col.id, { name: e.target.value.toLowerCase() })
                }
                className="bg-transparent text-white focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5 w-full font-mono font-semibold"
              />
              {(() => {
                const refs = findReferences(tables, selectedTable.name, col.name);
                return refs.length > 0 ? (
                  <span
                    className="block px-1.5 text-[9px] font-sans text-indigo-300"
                    title={refs.map((r) => `${r.tableName}.${r.columnName}`).join(', ')}
                  >
                    이름을 바꾸면 FK {refs.length}곳도 함께 변경
                  </span>
                ) : null;
              })()}
            </td>

            {/* [ERD 설계] 데이터 타입 */}
            <td className="p-2">
              <input
                type="text"
                disabled={isLocked}
                value={col.dataType}
                onChange={(e) =>
                  onUpdateColumn(selectedTable.id, col.id, { dataType: e.target.value.toUpperCase() })
                }
                list="datatype-suggestions"
                className="bg-transparent text-indigo-300 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5 w-full font-mono"
              />
            </td>

            {/* [ERD 설계] NULL 허용 */}
            <td className="p-2 text-center">
              <input
                type="checkbox"
                disabled={isLocked || col.isPrimaryKey}
                checked={col.isNullable}
                onChange={(e) =>
                  onUpdateColumn(selectedTable.id, col.id, { isNullable: e.target.checked })
                }
                className="rounded border-slate-700 text-slate-500"
              />
            </td>

            {/* [ERD 설계] 설명과 참조 */}
            <td className="p-2">
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  disabled={isLocked}
                  value={col.comment}
                  onChange={(e) =>
                    onUpdateColumn(selectedTable.id, col.id, { comment: e.target.value })
                  }
                  placeholder="설명..."
                  className="bg-transparent text-slate-400 focus:bg-slate-950 focus:outline-none rounded px-1 text-[10px] w-full"
                />
                {col.isForeignKey && (
                  <input
                    type="text"
                    disabled={isLocked}
                    value={col.references || ''}
                    onChange={(e) =>
                      onUpdateColumn(selectedTable.id, col.id, { references: e.target.value })
                    }
                    placeholder="참조 (예: users.id)"
                    className="bg-slate-950 text-sky-400 border border-sky-800/50 rounded px-1 text-[10px] w-full font-mono"
                  />
                )}
              </div>
            </td>

            {/* [ERD 설계] 컬럼 삭제 */}
            <td className="p-2 text-center">
              {!isLocked && selectedTable.columns.length > 1 && (
                <button
                  onClick={() => onDeleteColumn(selectedTable.id, col.id)}
                  className="text-slate-600 hover:text-rose-400 p-0.5"
                  title="컬럼 삭제"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
