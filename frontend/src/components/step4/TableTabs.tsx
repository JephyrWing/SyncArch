import React from 'react';
import { Database } from 'lucide-react';
import type { ErdTable } from '../../types/index.ts';

interface TableTabsProps {
  tables: ErdTable[];
  selectedTableId?: string;
  onSelectTable: (id: string) => void;
}

export const TableTabs: React.FC<TableTabsProps> = ({ tables, selectedTableId, onSelectTable }) => (
  <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/40 flex items-center gap-1.5 overflow-x-auto shrink-0">
    {tables.map((t) => {
      const isSelected = selectedTableId === t.id;
      return (
        <button
          key={t.id}
          onClick={() => onSelectTable(t.id)}
          className={`px-2.5 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
            isSelected
              ? 'bg-indigo-600 text-white font-bold shadow'
              : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
          }`}
        >
          <Database className="w-3 h-3 text-sky-400" />
          <span>{t.name}</span>
          <span className="text-[10px] opacity-75">({t.columns.length})</span>
        </button>
      );
    })}
  </div>
);
