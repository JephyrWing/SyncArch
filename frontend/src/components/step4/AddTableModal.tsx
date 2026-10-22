import React, { useState } from 'react';
import { Database, Plus, X } from 'lucide-react';
import type { ErdColumn, ErdTable, FeatureSpec, SqlDialect } from '../../types/index.ts';
import { featureCode } from '../../utils/features.ts';

interface AddTableModalProps {
  open: boolean;
  features: FeatureSpec[];
  tables: ErdTable[];
  targetDbms: SqlDialect;
  isLocked: boolean;
  onAddTable: (table: Omit<ErdTable, 'id'>) => void;
  onClose: () => void;
}

// [ERD 설계] 닫혀도 마운트를 유지해 다시 열 때 입력값이 남는다(분리 전 동작 유지).
export const AddTableModal: React.FC<AddTableModalProps> = ({ open, features, tables, targetDbms, isLocked, onAddTable, onClose }) => {
  const [newTableName, setNewTableName] = useState('');
  const [newTableComment, setNewTableComment] = useState('');
  const [newTableFeatures, setNewTableFeatures] = useState<string[]>([]);
  const normalizedName = newTableName.trim().toLowerCase();
  const nameError = !/^[a-z_][a-z0-9_]{0,63}$/.test(normalizedName)
    ? '소문자·숫자·밑줄 64자 이하로 입력하세요.'
    : tables.some((table) => table.name.toLowerCase() === normalizedName) ? '같은 이름의 테이블이 있습니다.' : '';

  const handleCreateTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameError || isLocked) return;

    const baseColumns: ErdColumn[] = [
      {
        id: crypto.randomUUID(),
        name: 'id',
        dataType: targetDbms === 'mysql' ? 'VARCHAR(36)' : 'UUID',
        isPrimaryKey: true,
        isForeignKey: false,
        isUnique: true,
        isNullable: false,
        comment: '고유 식별자',
      },
      {
        id: crypto.randomUUID(),
        name: 'created_at',
        dataType: targetDbms === 'mysql' ? 'DATETIME(6)' : 'TIMESTAMPTZ',
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
        isNullable: false,
        defaultValue: 'CURRENT_TIMESTAMP',
        comment: '생성 시각',
      },
    ];

    onAddTable({
      name: newTableName.trim().toLowerCase(),
      comment: newTableComment.trim() || '신규 테이블',
      relatedFeatureIds: newTableFeatures,
      columns: baseColumns,
      x: 100 + Math.floor(Math.random() * 200),
      y: 100 + Math.floor(Math.random() * 200),
    });

    setNewTableName('');
    setNewTableComment('');
    setNewTableFeatures([]);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <span>신규 ERD 테이블 생성</span>
          </h4>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreateTable} className="p-5 space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-300">테이블 이름 (소문자, 언더스코어)</label>
            <input
              type="text"
              placeholder="예: study_reviews"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 mt-1 font-mono"
            />
            {newTableName && nameError && <p role="alert" className="mt-1 text-xs text-rose-300">{nameError}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">테이블 설명 / 주석</label>
            <input
              type="text"
              placeholder="예: 스터디 완료 후 수강생 후기 및 평점"
              value={newTableComment}
              onChange={(e) => setNewTableComment(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">연관 기능 선택 (Step 2 추적 매핑)</label>
            <div className="grid grid-cols-2 gap-1.5 mt-1.5 max-h-32 overflow-y-auto p-2 bg-slate-950 rounded-lg border border-slate-800">
              {features.map((feat) => {
                const isChecked = newTableFeatures.includes(feat.id);
                return (
                  <label
                    key={feat.id}
                    className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewTableFeatures([...newTableFeatures, feat.id]);
                        } else {
                          setNewTableFeatures(newTableFeatures.filter((id) => id !== feat.id));
                        }
                      }}
                      className="rounded border-slate-700 text-indigo-500"
                    />
                    <span className="font-mono text-[10px] text-indigo-400">[{featureCode(feat)}]</span>
                    <span className="truncate">{feat.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLocked || !!nameError}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>테이블 생성</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
