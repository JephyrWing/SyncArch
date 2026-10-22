import React from 'react';
import { History, X } from 'lucide-react';
import type { ArchVersion } from '../../types/index.ts';

interface VersionHistoryModalProps {
  archVersions: ArchVersion[];
  currentVersionId: string;
  onSwitchVersion: (versionId: string) => void;
  onClose: () => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  archVersions,
  currentVersionId,
  onSwitchVersion,
  onClose,
}) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-150">
    <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
      <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">아키텍처 버전 히스토리</h4>
            <p className="text-[11px] text-slate-400">저장된 버전 스냅샷을 확인하고 원하는 버전으로 전환합니다.</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 divide-y divide-slate-800 max-h-[60vh] overflow-y-auto space-y-3">
        {archVersions.map((ver) => {
          const isActive = ver.id === currentVersionId;
          return (
            <div key={ver.id} className="pt-3 first:pt-0 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white font-mono">{ver.versionNumber}</span>
                  <span className="text-xs text-indigo-300 font-semibold">{ver.label}</span>
                  {isActive && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-600/40">
                      현재 활성
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{ver.description}</p>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  작성 일시: {ver.createdAt} · 노드 {ver.nodes.length}개 · 연결선 {ver.connections.length}개
                </div>
              </div>

              {!isActive && (
                <button
                  onClick={() => {
                    onSwitchVersion(ver.id);
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-semibold shrink-0 transition-colors"
                >
                  이 버전 불러오기
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>
);
