import React, { useState } from 'react';
import type { ArchConnection, ArchNode, ArchProtocol } from '../../types/index.ts';

interface AddConnectionFormProps {
  open: boolean;
  nodes: ArchNode[];
  isLocked: boolean;
  onAddConnection: (conn: Omit<ArchConnection, 'id'>) => void;
  onClose: () => void;
}

// [시스템 아키텍처] 닫혀도 마운트를 유지해 다시 열 때 선택값이 남는다(분리 전 동작 유지).
export const AddConnectionForm: React.FC<AddConnectionFormProps> = ({ open, nodes, isLocked, onAddConnection, onClose }) => {
  const [sourceNodeId, setSourceNodeId] = useState(nodes[0]?.id || '');
  const [targetNodeId, setTargetNodeId] = useState(nodes[1]?.id || '');
  const [protocol, setProtocol] = useState<ArchProtocol>('REST');
  const [connLabel, setConnLabel] = useState('');
  const [connDescription, setConnDescription] = useState('');
  // [시스템 아키텍처] 팀원이 노드를 추가·삭제하면 폼을 연 뒤 목록이 바뀐다. 없어진 선택값은 현재 목록의 기본값으로 바꾼다.
  const pick = (id: string, fallback: ArchNode | undefined) => (nodes.some((n) => n.id === id) ? id : fallback?.id || '');
  const sourceId = pick(sourceNodeId, nodes[0]);
  const targetId = pick(targetNodeId, nodes.find((n) => n.id !== sourceId));

  const handleCreateConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || !sourceId || !targetId || sourceId === targetId) return;

    onAddConnection({
      sourceId,
      targetId,
      protocol,
      label: connLabel.trim() || undefined,
      description: connDescription.trim() || '',
    });

    setConnLabel('');
    setConnDescription('');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="p-3 border-b border-slate-800 bg-slate-950/90 shrink-0 animate-in fade-in duration-100">
      <form onSubmit={handleCreateConnection} className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
          <span>컴포넌트 간 통신 연결선(Connection) 생성</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-[10px]"
          >
            닫기
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[10px] text-slate-400">출발 컴포넌트(Source)</label>
            <select
              value={sourceId}
              onChange={(e) => setSourceNodeId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.category})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-400">도착 컴포넌트(Target)</label>
            <select
              value={targetId}
              onChange={(e) => setTargetNodeId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
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
            <label className="text-[10px] text-slate-400">통신 프로토콜</label>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as ArchProtocol)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs font-mono"
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
            <label className="text-[10px] text-slate-400">라벨 이름 (옵션)</label>
            <input
              type="text"
              placeholder="예: 실시간 QR 인증 이벤트"
              value={connLabel}
              onChange={(e) => setConnLabel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] text-slate-400">상세 설명 / 프로토콜 규격 (description)</label>
          <input
            type="text"
            placeholder="예: WSS 양방향 동기화 및 heartbeat 30초 주기"
            value={connDescription}
            onChange={(e) => setConnDescription(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="submit"
            disabled={!sourceId || sourceId === targetId}
            className="px-3 py-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded text-xs font-semibold"
          >
            연결선 등록
          </button>
        </div>
      </form>
    </div>
  );
};
