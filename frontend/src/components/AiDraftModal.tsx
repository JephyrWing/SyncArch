import React, { useState } from 'react';
import { Sparkles, Check, X, CheckCheck, AlertCircle, Database, Layers, Workflow, Lightbulb } from 'lucide-react';
import type { StepNumber } from '../types/index.ts';

interface AiDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  step: StepNumber;
  draftData: any;
  onAcceptItems: (selectedItems: any) => void;
  isGenerating: boolean;
}

export const AiDraftModal: React.FC<AiDraftModalProps> = ({
  isOpen,
  onClose,
  step,
  draftData,
  onAcceptItems,
  isGenerating,
}) => {
  const [selectedIndices, setSelectedIndices] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: true,
  });

  if (!isOpen) return null;

  const getItemsList = () => {
    if (!draftData) return [];
    if (step === 1) return draftData.cards || [];
    if (step === 2) return draftData.features || [];
    if (step === 3) return draftData.nodes || [];
    if (step === 4) return draftData.tables || [];
    return [];
  };

  const items = getItemsList();

  const handleToggle = (idx: number) => {
    setSelectedIndices((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleSelectAll = (select: boolean) => {
    const next: Record<number, boolean> = {};
    items.forEach((_: any, idx: number) => {
      next[idx] = select;
    });
    setSelectedIndices(next);
  };

  const handleApply = () => {
    const accepted = items.filter((_: any, idx: number) => selectedIndices[idx]);
    onAcceptItems(accepted);
    onClose();
  };

  const stepTitles: Record<StepNumber, string> = {
    1: 'Step 1. 아이디어 & 유저 스토리 초안',
    2: 'Step 2. 기능 명세 & REST API 초안',
    3: 'Step 3. 시스템 아키텍처 노드 초안',
    4: 'Step 4. DB(ERD) 테이블 초안',
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>AI Co-Architect 초안 제안 (Diff &amp; Accept)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700/50">
                  비파괴적 제안
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{stepTitles[step]}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-4 py-2.5 bg-indigo-950/40 border-b border-indigo-900/40 text-xs text-indigo-300 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>기존 설계 데이터를 덮어쓰지 않고, 선택한 제안 항목만 안전하게 추가합니다.</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <button onClick={() => handleSelectAll(true)} className="text-sky-400 hover:underline">
              전체 선택
            </button>
            <span>·</span>
            <button onClick={() => handleSelectAll(false)} className="text-slate-400 hover:underline">
              전체 해제
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isGenerating ? (
            <div className="py-16 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-medium">Gemini 3.8 Flash가 이전 단계 맥락을 분석하여 초안을 생성 중입니다...</p>
              <p className="text-[11px] text-slate-500">도메인 정합성 및 제3정규화 규칙을 검토하고 있습니다.</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              제안할 신규 초안이 없습니다.
            </div>
          ) : (
            items.map((item: any, idx: number) => {
              const isChecked = !!selectedIndices[idx];

              return (
                <div
                  key={idx}
                  onClick={() => handleToggle(idx)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-slate-900/90 border-emerald-500/60 ring-1 ring-emerald-500/30'
                      : 'bg-slate-950/60 border-slate-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggle(idx)}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-white">
                        {item.title || item.name || item.tableName || `제안 항목 #${idx + 1}`}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/40">
                        ✨ AI 신규 제안
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.category || item.domain || (item.columns ? `${item.columns.length} columns` : '')}
                    </span>
                  </div>

                  {/* Description / Fields preview */}
                  <p className="text-xs text-slate-300 leading-relaxed mb-2 pl-6">
                    {item.description || item.summary || item.comment}
                  </p>

                  {/* If feature: method & endpoint */}
                  {item.method && (
                    <div className="pl-6 flex items-center gap-2 text-[11px] font-mono text-slate-400">
                      <span className="text-sky-400 font-bold">{item.method}</span>
                      <span>{item.endpoint}</span>
                    </div>
                  )}

                  {/* If Table: columns preview */}
                  {item.columns && (
                    <div className="pl-6 flex items-center gap-1.5 flex-wrap pt-1">
                      {item.columns.map((col: any, cidx: number) => (
                        <span
                          key={cidx}
                          className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-slate-300"
                        >
                          {col.isPrimaryKey ? '🔑 ' : col.isForeignKey ? '🔗 ' : ''}
                          {col.name}: {col.dataType}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            총 {items.length}개 항목 중{' '}
            <strong className="text-white">
              {items.filter((_: any, idx: number) => selectedIndices[idx]).length}개 선택됨
            </strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleApply}
              disabled={items.filter((_: any, idx: number) => selectedIndices[idx]).length === 0}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>선택 항목 수락 (Accept)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
