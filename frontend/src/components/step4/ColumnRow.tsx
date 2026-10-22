import React, { useId, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ErdColumn, ErdTable, SqlDialect } from '../../types/index.ts';
import { findReferences } from '../../utils/erdRename.ts';
import { foreignKeyColumnUpdateError, foreignKeyError } from '../../utils/foreignKeyValidation.ts';
import { DataTypeInput } from './DataTypeInput.tsx';

interface ColumnRowProps {
  table: ErdTable;
  tables: ErdTable[];
  column: ErdColumn;
  targetDbms: SqlDialect;
  isLocked: boolean;
  onUpdateColumn: (tableId: string, colId: string, patch: Partial<ErdColumn>) => void;
  onDeleteColumn: (tableId: string, colId: string) => void;
}

export const ColumnRow: React.FC<ColumnRowProps> = ({ table, tables, column, targetDbms, isLocked, onUpdateColumn, onDeleteColumn }) => {
  const id = useId();
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [changeError, setChangeError] = useState('');
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const nameError = nameDraft === null ? '' : !/^[a-z_][a-z0-9_]{0,63}$/.test(nameDraft)
    ? '소문자·숫자·밑줄 64자 이하로 입력하세요.'
    : table.columns.some((item) => item.id !== column.id && item.name.toLowerCase() === nameDraft)
      ? '같은 이름의 컬럼이 있습니다.' : '';
  const linking = linkDraft !== null || column.isForeignKey;
  const reference = linkDraft ?? column.references ?? '';
  const linkError = linking ? foreignKeyError(tables, table, { ...column, isForeignKey: true, references: reference }) : '';
  const refs = findReferences(tables, table.name, column.name);
  const update = (patch: Partial<ErdColumn>): string | undefined => {
    if (isLocked) return '잠긴 문서는 변경할 수 없습니다.';
    const issue = foreignKeyColumnUpdateError(tables, table.id, column.id, patch);
    const typeEdit = ['dataType', 'length', 'precision', 'scale'].some((key) => key in patch);
    setChangeError(typeEdit ? '' : issue);
    if (issue) return issue;
    onUpdateColumn(table.id, column.id, patch);
  };
  const applyLink = () => {
    if (linkDraft === null || isLocked || linkError) return;
    const issue = update({ isForeignKey: true, references: linkDraft.trim() });
    if (!issue) setLinkDraft(null);
  };
  const inputClass = 'w-full rounded bg-transparent px-1.5 py-0.5 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return <tr className="hover:bg-slate-800/30 transition-colors">
    <td className="p-2 align-top"><input type="checkbox" aria-label={`${column.name} PK`} disabled={isLocked} checked={column.isPrimaryKey}
      onChange={(event) => update({ isPrimaryKey: event.target.checked, isNullable: event.target.checked ? false : column.isNullable })} /></td>
    <td className="p-2 align-top"><input type="checkbox" aria-label={`${column.name} FK`} disabled={isLocked} checked={linking}
      onChange={(event) => {
        setChangeError('');
        if (event.target.checked) setLinkDraft(column.references ?? '');
        else {
          if (column.isForeignKey) update({ isForeignKey: false, references: undefined });
          setLinkDraft(null);
        }
      }} /></td>
    <td className="p-2 align-top">
      <input type="text" aria-label={`${column.name} 컬럼명`} disabled={isLocked} value={nameDraft ?? column.name}
        onChange={(event) => setNameDraft(event.target.value.toLowerCase())}
        onKeyDown={(event) => { if (event.key === 'Escape') setNameDraft(null); }} className={`${inputClass} font-semibold text-white`} />
      {nameDraft !== null && <div className="space-y-1 font-sans text-[10px]">
        {nameError && <span role="alert" className="text-rose-300">{nameError}</span>}
        <div className="text-indigo-300">함께 바뀌는 FK {refs.length}개
          <ul>{refs.map((ref) => <li key={`${ref.tableId}:${ref.columnId}`}>{ref.tableName}.{ref.columnName}: {table.name}.{column.name} → {table.name}.{nameDraft}</li>)}</ul>
        </div>
        <button type="button" disabled={isLocked || !!nameError} onClick={() => {
          if (nameError || nameDraft === null) return;
          if (!update({ name: nameDraft })) setNameDraft(null);
        }} className="rounded bg-indigo-600 px-2 py-1 text-white disabled:opacity-50">컬럼명 적용</button>
        <button type="button" onClick={() => setNameDraft(null)} className="ml-2 text-slate-300">취소</button>
      </div>}
    </td>
    <td className="p-2 align-top">
      <DataTypeInput key={`${column.id}:${targetDbms}`} column={column} dialect={targetDbms} disabled={isLocked} onChange={update} />
    </td>
    <td className="p-2 text-center align-top"><input type="checkbox" aria-label={`${column.name} NULL 허용`} disabled={isLocked || column.isPrimaryKey}
      checked={column.isNullable} onChange={(event) => update({ isNullable: event.target.checked })} /></td>
    <td className="p-2 align-top">
      <div className="flex min-w-36 flex-col gap-1">
        <label className="flex items-center gap-1 font-sans text-[10px] text-slate-400"><input type="checkbox" aria-label={`${column.name} UNIQUE`} disabled={isLocked}
          checked={column.isUnique} onChange={(event) => update({ isUnique: event.target.checked })} />고유 값</label>
        <input type="text" aria-label={`${column.name} 기본값`} disabled={isLocked} value={column.defaultValue ?? ''}
          onChange={(event) => update({ defaultValue: event.target.value || undefined })} placeholder="기본값..." className={inputClass} />
        <input type="text" aria-label={`${column.name} 설명`} disabled={isLocked} value={column.comment}
          onChange={(event) => update({ comment: event.target.value })} placeholder="설명..." className={`${inputClass} text-[10px] text-slate-400`} />
        {linking && <>
          <input type="text" aria-label={`${column.name} 참조 컬럼`} aria-invalid={!!linkError} aria-describedby={linkError ? `${id}-link-error` : `${id}-link-hint`}
            disabled={isLocked} value={reference} onChange={(event) => { setLinkDraft(event.target.value); setChangeError(''); }} onBlur={applyLink}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); applyLink(); }
              if (event.key === 'Escape') { event.preventDefault(); setLinkDraft(null); setChangeError(''); }
            }}
            placeholder="참조 (예: users.id)" className="w-full rounded border border-sky-800/50 bg-slate-950 px-1 py-1 font-mono text-[10px] text-sky-400" />
          {linkError ? <span id={`${id}-link-error`} role="alert" className="max-w-64 whitespace-normal font-sans text-[10px] text-rose-300">{linkError}</span>
            : <span id={`${id}-link-hint`} className="max-w-64 whitespace-normal font-sans text-[9px] text-emerald-400">타입·길이·정밀도 일치{linkDraft !== null ? ' · Enter 또는 다른 영역 클릭으로 연결' : ''}</span>}
          {linkDraft !== null && <span className="font-sans text-[9px] text-slate-500">연결 편집 중 · Escape로 취소 · 아직 저장되지 않았습니다</span>}
        </>}
        {changeError && <span role="alert" className="max-w-64 whitespace-normal font-sans text-[10px] text-rose-300">{changeError}</span>}
      </div>
    </td>
    <td className="p-2 text-center align-top">{!isLocked && table.columns.length > 1 && <button onClick={() => onDeleteColumn(table.id, column.id)} title="컬럼 삭제" className="p-0.5 text-slate-600 hover:text-rose-400"><Trash2 className="h-3 w-3" /></button>}</td>
  </tr>;
};
