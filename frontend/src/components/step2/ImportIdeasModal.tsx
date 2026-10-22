import { useState } from 'react';
import type { FeatureSpec, IdeaCard } from '../../types/index.ts';

interface Props { ideas: IdeaCard[]; features: FeatureSpec[]; onImport: (ids: string[]) => void; onClose: () => void }
export function ImportIdeasModal({ ideas, features, onImport, onClose }: Props) {
  const [selected,setSelected] = useState<Set<string>>(()=>new Set());
  const imported = new Set(features.map(f=>f.relatedStoryId).filter(Boolean));
  const chosen = ideas.filter(i=>selected.has(i.id) && !imported.has(i.id));
  return <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4">
    <div role="dialog" aria-modal="true" aria-label="아이디어 가져오기" className="w-full max-w-xl max-h-full sm:max-h-[85vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-200">
      <h2 className="text-sm font-bold">아이디어 가져오기</h2>
      <p className="text-xs text-slate-400 mt-1 mb-3">투표 수와 펼침 상태에 관계없이 원본 아이디어를 선택하세요.</p>
      <div className="overflow-y-auto space-y-2 py-2">
        {ideas.map(idea=><label key={idea.id} className="flex items-start gap-2 rounded bg-slate-950/60 p-2 text-xs">
          <input type="checkbox" aria-label={idea.title} disabled={imported.has(idea.id)} checked={selected.has(idea.id) && !imported.has(idea.id)} onChange={e=>setSelected(prev=>{const next=new Set(prev);if(e.target.checked)next.add(idea.id);else next.delete(idea.id);return next;})} />
          <span>{idea.title}<span className="block text-[10px] text-slate-400">{idea.parentIdeaId ? `파생 · 부모: ${ideas.find(i=>i.id===idea.parentIdeaId)?.title ?? idea.parentIdeaId}` : '루트'}{imported.has(idea.id) ? ' · 이미 가져옴' : ''}</span></span>
        </label>)}
      </div>
      <div className="flex justify-end gap-2 mt-3"><button className="px-3 py-1.5 rounded bg-slate-800 text-xs" onClick={onClose}>취소</button>
        <button disabled={!chosen.length} className="px-3 py-1.5 rounded bg-indigo-600 disabled:opacity-40 text-xs" onClick={()=>{onImport(chosen.map(i=>i.id));onClose();}}>선택 가져오기</button></div>
    </div>
  </div>;
}
