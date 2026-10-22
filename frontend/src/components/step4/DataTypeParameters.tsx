import React, { useId, useState } from 'react';
import { mariaDbTypeError, mariaDbTypeParameters, withMariaDbTypeParameters } from '../../utils/mariadbTypes.ts';

interface DataTypeParametersProps {
  expression: string;
  columnName: string;
  disabled: boolean;
  onApply: (expression: string) => string | void;
  onCancel?: () => void;
}

/** [ERD 설계] 정밀도 두 항목을 함께 편집한 뒤 포커스 이동이나 Enter로 적용한다. */
export const DataTypeParameters: React.FC<DataTypeParametersProps> = ({ expression, columnName, disabled, onApply, onCancel }) => {
  const id = useId();
  const parameters = mariaDbTypeParameters(expression);
  const initial = parameters.map((parameter) => String(parameter.value));
  const [values, setValues] = useState(initial);
  const [error, setError] = useState('');
  if (!parameters.length) return null;

  const apply = () => {
    if (disabled || values.every((value, index) => value === initial[index])) return;
    const next = withMariaDbTypeParameters(expression, values);
    const issue = values.some((value) => !/^\d+$/.test(value)) ? '모든 항목에 정수를 입력하세요.' : mariaDbTypeError(next);
    setError(issue);
    if (!issue) {
      const blocked = onApply(next);
      if (blocked) setError(blocked);
    }
  };

  return (
    <div className="mt-1 rounded border border-slate-700/70 bg-slate-950/50 p-1.5 font-sans"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) apply(); }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); apply(); }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setValues(initial); setError(''); onCancel?.(); }
      }}>
      <div className="flex flex-wrap gap-2">
        {parameters.map((parameter, index) => (
          <label key={parameter.key} className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] text-slate-400">
            {parameter.label}
            <input type="number" inputMode="numeric" step={1} min={parameter.min} max={parameter.max}
              aria-label={`${columnName} ${parameter.label}`} aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : `${id}-hint`} disabled={disabled} value={values[index]}
              onChange={(event) => { setValues(values.map((value, i) => i === index ? event.target.value : value)); setError(''); }}
              className="w-full min-w-16 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 font-mono text-[11px] text-indigo-200 focus:border-indigo-500 focus:outline-none disabled:opacity-50" />
          </label>
        ))}
      </div>
      <span id={`${id}-hint`} className="mt-1 block text-[9px] text-slate-500">
        {parameters.length === 2 ? '소수 자릿수는 전체 자릿수 이하 · Enter 또는 다른 영역 클릭으로 적용' : `허용 범위 ${parameters[0].min}~${parameters[0].max} · Enter로 적용`}
      </span>
      {error && <span id={`${id}-error`} role="alert" className="mt-1 block text-[10px] text-rose-300">{error}</span>}
    </div>
  );
};
