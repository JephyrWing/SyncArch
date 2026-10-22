import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { ErdColumn, SqlDialect } from '../../types/index.ts';
import { columnTypeExpression, MARIADB_TYPES, mariaDbTypeError, normalizeTypeExpression, searchMariaDbTypes } from '../../utils/mariadbTypes.ts';
import { DataTypeParameters } from './DataTypeParameters.tsx';

interface DataTypeInputProps {
  column: ErdColumn;
  dialect: SqlDialect;
  disabled: boolean;
  onChange: (patch: Partial<ErdColumn>) => string | void;
}

export const DataTypeInput: React.FC<DataTypeInputProps> = ({ column, dialect, disabled, onChange }) => {
  const id = useId();
  const expression = columnTypeExpression(column);
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [error, setError] = useState('');
  const [position, setPosition] = useState({ left: 0, top: 0, width: 320, maxHeight: 240 });
  const options = query ? searchMariaDbTypes(query) : MARIADB_TYPES;
  const showOptions = open && !disabled && dialect === 'mariadb';

  useEffect(() => {
    if (!showOptions) return;
    const closeOnScroll = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-type-popup]')) setOpen(false);
    };
    const close = () => setOpen(false);
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [showOptions]);

  const commit = (value: string) => {
    const next = normalizeTypeExpression(value);
    const issue = dialect === 'mariadb' ? mariaDbTypeError(next) : '';
    setError(issue);
    if (issue) { setDraft(value); setOpen(false); return issue; }
    if (next && next !== expression) {
      const blocked = onChange({ dataType: next, length: undefined, precision: undefined, scale: undefined });
      if (blocked) { setError(blocked); setDraft(value); setOpen(false); return blocked; }
    }
    setDraft(null);
    setOpen(false);
  };
  const show = (input: HTMLInputElement) => {
    const rect = input.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 16);
    const below = window.innerHeight - rect.bottom - 12;
    const maxHeight = Math.min(280, Math.max(100, below >= 160 ? below : rect.top - 12));
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: below >= 160 ? rect.bottom + 4 : Math.max(8, rect.top - maxHeight - 4), width, maxHeight });
    setOpen(true);
  };

  return (
    <div className="min-w-36">
      <div className="relative">
        <input
          role="combobox"
          aria-label={`${column.name} 데이터 타입`}
          aria-expanded={showOptions}
          aria-controls={showOptions ? `${id}-list` : undefined}
          aria-autocomplete="list"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-activedescendant={showOptions && active >= 0 ? `${id}-${active}` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={draft ?? expression}
          onFocus={(e) => { setQuery(''); setActive(-1); show(e.currentTarget); }}
          onClick={(e) => { if (!open) { setQuery(''); setActive(-1); show(e.currentTarget); } }}
          onChange={(e) => { setError(''); setDraft(e.target.value); setQuery(e.target.value); setActive(-1); show(e.currentTarget); }}
          onBlur={() => { if (draft !== null) commit(draft); else setOpen(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); setDraft(null); setError(''); setOpen(false); }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              if (dialect !== 'mariadb') return;
              e.preventDefault();
              show(e.currentTarget);
              setActive((index) => !options.length ? -1 : index < 0 ? (e.key === 'ArrowDown' ? 0 : options.length - 1)
                : (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(showOptions && active >= 0 && options[active] ? options[active].value : draft ?? expression);
            }
          }}
          className="w-full rounded bg-transparent px-1.5 py-1 pr-5 font-mono text-indigo-300 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <ChevronDown className="pointer-events-none absolute right-1 top-1.5 h-3 w-3 text-slate-500" />
      </div>
      <span className="block px-1.5 text-[9px] font-sans text-slate-500">타입 검색 · 길이/정밀도 직접 입력 가능</span>
      {dialect === 'mariadb' && <DataTypeParameters key={expression} expression={expression} columnName={column.name} disabled={disabled} onApply={commit}
        onCancel={() => { setDraft(null); setError(''); }} />}
      {error && <span id={`${id}-error`} role="alert" className="block max-w-60 px-1.5 font-sans text-[10px] text-rose-300">{error}</span>}
      {showOptions && createPortal(
        <div data-type-popup style={position} className="fixed z-[100] overflow-y-auto rounded-lg border border-slate-600 bg-slate-900 p-1 shadow-xl"
          onMouseDown={(e) => e.preventDefault()}>
          <div className="px-2 py-1 font-sans text-[10px] text-slate-400">MariaDB 11.4 · {options.length}개 · ↑↓ 선택 / Enter 적용</div>
          <div id={`${id}-list`} role="listbox" aria-label="MariaDB 데이터 타입">
            {options.map((option, index) => (
              <div key={option.name} id={`${id}-${index}`} role="option" aria-selected={active === index}
                onPointerMove={() => setActive(index)} onClick={() => commit(option.value)}
                ref={(element) => { if (active === index) element?.scrollIntoView({ block: 'nearest' }); }}
                className={`cursor-pointer rounded px-2 py-1.5 text-xs ${active === index ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-slate-800'}`}>
                <div className="flex justify-between gap-3"><span className="font-mono">{option.name}</span><span className="text-[10px] opacity-60">{option.group}</span></div>
                <div className="mt-0.5 font-sans text-[10px] opacity-70">{option.description}</div>
              </div>
            ))}
            {!options.length && <div className="p-2 font-sans text-xs text-slate-400">일치하는 타입이 없습니다. 전체 표기를 직접 입력하고 Enter를 누르세요.</div>}
          </div>
        </div>, document.body)}
    </div>
  );
};
