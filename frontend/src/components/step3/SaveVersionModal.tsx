import React, { useState } from 'react';
import { Save, X } from 'lucide-react';

interface SaveVersionModalProps {
  open: boolean;
  defaultVersionNumber: string;
  onSave: (versionNumber: string, label: string, description: string) => void;
  onClose: () => void;
}

// [시스템 아키텍처] 닫혀도 마운트를 유지해 다시 열 때 입력값이 남는다(분리 전 동작 유지).
export const SaveVersionModal: React.FC<SaveVersionModalProps> = ({ open, defaultVersionNumber, onSave, onClose }) => {
  // [시스템 아키텍처] 새 버전 입력
  const [newVersionNum, setNewVersionNum] = useState(defaultVersionNumber);
  const [newVersionLabel, setNewVersionLabel] = useState('이벤트 기반 MSA 확장');
  const [newVersionDesc, setNewVersionDesc] = useState('고성능 트래픽 대응을 위한 비동기 이벤트 스트리밍 아키텍처 스냅샷');

  const handleSaveVersionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionNum.trim()) return;
    onSave(newVersionNum.trim(), newVersionLabel.trim() || '신규 버전', newVersionDesc.trim());
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Save className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">아키텍처 신규 버전 스냅샷 저장</h4>
              <p className="text-[11px] text-slate-400">
                현재 캔버스의 노드 배치 및 연결선을 버전으로 박제합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSaveVersionSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-300">버전 식별 번호</label>
            <input
              type="text"
              value={newVersionNum}
              onChange={(e) => setNewVersionNum(e.target.value)}
              placeholder="예: v2.0 (Kafka 마이크로서비스)"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 mt-1 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">버전 핵심 라벨</label>
            <input
              type="text"
              value={newVersionLabel}
              onChange={(e) => setNewVersionLabel(e.target.value)}
              placeholder="예: 비동기 큐 분리"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">변경 사유 및 설명</label>
            <textarea
              rows={3}
              value={newVersionDesc}
              onChange={(e) => setNewVersionDesc(e.target.value)}
              placeholder="이번 아키텍처 개편에서 무엇이 변경되었는지 기록하세요..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 mt-1 resize-none"
            />
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
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 shadow"
            >
              <Save className="w-3.5 h-3.5" />
              <span>새 버전으로 저장</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
