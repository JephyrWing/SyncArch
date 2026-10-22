import { useState } from 'react';
import type { FeatureSpec, TeamMember, HttpMethod, PriorityLevel, FeatureProgressStatus } from '../../types/index.ts';

interface Props { feature: FeatureSpec; members: TeamMember[]; onSave: (id: string, changes: Partial<FeatureSpec>) => void; onClose: () => void }
const fields = (f: FeatureSpec) => ({ name: f.name, domain: f.domain ?? '', assignee: f.assignee ?? '',
  priority: f.priority ?? '', method: f.method ?? '', endpoint: f.endpoint ?? '', requestFields: f.requestFields ?? '',
  responseFields: f.responseFields ?? '', summary: f.summary ?? '', status: f.status,
  responseStatusCodes: (f.responseStatusCodes ?? []).join('\n') });

/** 모달을 연 뒤 바꾼 필드만 전달해 팀원의 다른 필드 변경과 내부 ID를 보존한다. */
export function EditFeatureModal({ feature, members, onSave, onClose }: Props) {
  const [opened] = useState(() => fields(feature));
  const [draft, setDraft] = useState(opened);
  const [error, setError] = useState('');
  const input = 'w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white';
  const update = (key: keyof typeof draft, value: string) => setDraft(prev => ({ ...prev, [key]: value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) { setError('기능명을 입력하세요.'); return; }
    const codes = draft.responseStatusCodes.split('\n').map(s => s.trim()).filter(Boolean);
    if (codes.some(code => !/^[1-5]\d{2}(?: [^\x00\r\n]{1,100})?$/.test(code))) {
      setError('응답 상태 코드는 한 줄에 하나씩 입력하세요. 예: 200 OK'); return;
    }
    const changed = Object.fromEntries(Object.entries(draft).filter(([k,v]) => v !== opened[k as keyof typeof opened]));
    const changes: Partial<FeatureSpec> = { ...changed } as Partial<FeatureSpec>;
    if ('name' in changed) changes.name = draft.name.trim();
    if ('endpoint' in changed) changes.endpoint = draft.endpoint.trim();
    if ('priority' in changed) changes.priority = draft.priority as PriorityLevel || undefined;
    if ('method' in changed) changes.method = draft.method as HttpMethod || undefined;
    if ('status' in changed) changes.status = draft.status as FeatureProgressStatus;
    if ('responseStatusCodes' in changed) changes.responseStatusCodes = codes;
    onSave(feature.id, changes); onClose();
  };
  return <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
    <form role="dialog" aria-modal="true" aria-label="기능 편집" onSubmit={submit}
      className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
      <h2 className="text-sm font-bold text-white">기능 편집</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {([['name','기능명'],['domain','도메인'],['endpoint','엔드포인트 경로']] as const).map(([key,label]) =>
          <label key={key} className="text-xs text-slate-300">{label}<input autoFocus={key==='name'} maxLength={key==='name'?120:5000} className={input} value={draft[key]} onChange={e=>update(key,e.target.value)} /></label>)}
        <label className="text-xs text-slate-300">담당자<select aria-label="담당자" className={input} value={draft.assignee} onChange={e=>update('assignee',e.target.value)}>
          <option value="">미지정</option>
          {[...new Set([draft.assignee,...members.map(m=>m.name)])].filter(Boolean).map(name=><option key={name} value={name}>{name}</option>)}
        </select></label>
        <label className="text-xs text-slate-300">우선순위<select aria-label="우선순위" className={input} value={draft.priority} onChange={e=>update('priority',e.target.value)}>
          <option value="">미지정</option>{['P0','P1','P2'].map(v=><option key={v}>{v}</option>)}
        </select></label>
        <label className="text-xs text-slate-300">HTTP 메서드<select aria-label="HTTP 메서드" className={input} value={draft.method} onChange={e=>update('method',e.target.value)}>
          <option value="">미지정</option>{['GET','POST','PUT','PATCH','DELETE'].map(v=><option key={v}>{v}</option>)}
        </select></label>
        <label className="text-xs text-slate-300">진행상황<select aria-label="진행상황" className={input} value={draft.status} onChange={e=>update('status',e.target.value)}>
          {Object.entries({PLANNED:'계획',IN_PROGRESS:'진행중',QA:'QA 검증',COMPLETED:'완료됨'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>
      {([['requestFields','Request Fields'],['responseFields','Response Fields'],['summary','기능 설명'],['responseStatusCodes','응답 상태 코드']] as const).map(([key,label])=>
        <label key={key} className="block text-xs text-slate-300">{label}<textarea aria-label={label} className={input} rows={2} maxLength={5000} value={draft[key]} onChange={e=>update(key,e.target.value)} /></label>)}
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300" onClick={onClose}>취소</button>
        <button type="submit" className="px-3 py-1.5 rounded bg-indigo-600 text-xs text-white">변경 저장</button></div>
    </form>
  </div>;
}
