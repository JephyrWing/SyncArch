import React, { useState } from 'react';
import { Link, X } from 'lucide-react';
import type { ArchConnection, ArchNode, ArchProtocol } from '../../types/index.ts';
import { changedFields } from '../../utils/architecture.ts';

interface EditConnectionModalProps {
  connection: ArchConnection;
  nodes: ArchNode[];
  onSave: (updated: Partial<ArchConnection>) => void;
  onClose: () => void;
}

// [시스템 아키텍처] 연결선 속성 편집(TC-ARCH-02). id는 그대로 두어 팀원 병합이 필드 단위로 이뤄진다.
export const EditConnectionModal: React.FC<EditConnectionModalProps> = ({ connection, nodes, onSave, onClose }) => {
  // [시스템 아키텍처] 연 시점의 폼 값. 폴링으로 connection이 바뀌어도 이것과 비교해 내가 고친 필드만 보낸다.
  const [opened] = useState(() => ({
    sourceId: connection.sourceId,
    targetId: connection.targetId,
    protocol: connection.protocol,
    label: (connection.label || '').trim(),
    description: (connection.description || '').trim(),
  }));
  const [sourceId, setSourceId] = useState(opened.sourceId);
  const [targetId, setTargetId] = useState(opened.targetId);
  const [protocol, setProtocol] = useState<ArchProtocol>(opened.protocol);
  const [label, setLabel] = useState(opened.label);
  const [description, setDescription] = useState(opened.description);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceId === targetId) return;
    const patch: Partial<ArchConnection> = changedFields(opened, {
      sourceId,
      targetId,
      protocol,
      label: label.trim(),
      description: description.trim(),
    });
    if (Object.keys(patch).length > 0) onSave(patch);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Link className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">통신 연결선 속성 편집</h4>
              <p className="text-[11px] text-slate-400 font-mono">
                ID 보존: {connection.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-300">출발 노드 (Source)</label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.category})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300">도착 노드 (Target)</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-300">통신 프로토콜</label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as ArchProtocol)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              >
                <option value="REST">REST (Sky Blue - HTTPS)</option>
                <option value="WebSocket">WebSocket (Amber - 실시간 WSS)</option>
                <option value="gRPC">gRPC (Purple - 내부 RPC)</option>
                <option value="Pub/Sub">Pub/Sub (Rose - 이벤트 큐)</option>
                <option value="SQL">SQL (Emerald - DB 커넥션)</option>
                <option value="Redis">Redis (Orange - 캐시 커맨드)</option>
                <option value="Kafka">Kafka (Cyan - 스트리밍)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300">라벨 이름 (옵션)</label>
              <input
                type="text"
                placeholder="예: 실시간 QR 인증 이벤트"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300">상세 설명 / 프로토콜 규격 (description)</label>
            <textarea
              rows={2}
              placeholder="통신 방식, 방향성, 주기 또는 페이로드 규격을 기재합니다."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={sourceId === targetId}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 transition-colors shadow-lg shadow-sky-600/20"
            >
              속성 저장 (ID 보존)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
