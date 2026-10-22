import React from 'react';
import type { ErdColumn, ErdTable, SqlDialect } from '../../types/index.ts';
import { ColumnRow } from './ColumnRow.tsx';

interface ColumnTableProps {
  table: ErdTable;
  tables: ErdTable[];
  targetDbms: SqlDialect;
  isLocked: boolean;
  onUpdateColumn: (tableId: string, colId: string, updated: Partial<ErdColumn>) => void;
  onDeleteColumn: (tableId: string, colId: string) => void;
}

export const ColumnTable: React.FC<ColumnTableProps> = ({
  table: selectedTable,
  tables,
  targetDbms,
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
          <ColumnRow key={col.id} table={selectedTable} tables={tables} column={col}
            targetDbms={targetDbms} isLocked={isLocked} onUpdateColumn={onUpdateColumn} onDeleteColumn={onDeleteColumn} />
        ))}
      </tbody>
    </table>
  </div>
);
