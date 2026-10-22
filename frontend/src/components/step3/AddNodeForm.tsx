import React, { useState } from 'react';
import type { ArchCategory, ArchNode } from '../../types/index.ts';

interface AddNodeFormProps {
  open: boolean;
  isLocked: boolean;
  onAddNode: (node: Omit<ArchNode, 'id'>) => void;
  onClose: () => void;
}

// [시스템 아키텍처] 닫혀도 마운트를 유지해 다시 열 때 입력값이 남는다(분리 전 동작 유지).
export const AddNodeForm: React.FC<AddNodeFormProps> = ({ open, isLocked, onAddNode, onClose }) => {
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeCategory, setNewNodeCategory] = useState<ArchCategory>('Service');
  const [newTechStack, setNewTechStack] = useState('');
  const [newNodeDesc, setNewNodeDesc] = useState('');
  const [newAssignedTeam, setNewAssignedTeam] = useState<'Frontend' | 'Backend' | 'Infra'>('Backend');

  const handleCreateNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim() || isLocked) return;

    onAddNode({
      name: newNodeName.trim(),
      category: newNodeCategory,
      techStack: newTechStack.split(',').map((s) => s.trim()).filter(Boolean),
      x: 100 + Math.floor(Math.random() * 250),
      y: 100 + Math.floor(Math.random() * 250),
      description: newNodeDesc.trim() || '아키텍처 컴포넌트',
      assignedTeam: newAssignedTeam,
    });

    setNewNodeName('');
    setNewTechStack('');
    setNewNodeDesc('');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="p-3 border-b border-slate-800 bg-slate-950/90 shrink-0 animate-in fade-in duration-100">
      <form onSubmit={handleCreateNode} className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
          <span>신규 아키텍처 노드 추가</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-[10px]"
          >
            닫기
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-slate-400">컴포넌트 이름</label>
            <input
              type="text"
              placeholder="예: Notification Worker"
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">레이어</label>
            <select
              value={newNodeCategory}
              onChange={(e) => setNewNodeCategory(e.target.value as ArchCategory)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
            >
              <option value="Client">Client</option>
              <option value="Service">Service</option>
              <option value="Messaging">Messaging</option>
              <option value="DataStore">DataStore</option>
              <option value="Infra">Infra</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-400">담당 조직</label>
            <select
              value={newAssignedTeam}
              onChange={(e) => setNewAssignedTeam(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
            >
              <option value="Backend">Backend</option>
              <option value="Frontend">Frontend</option>
              <option value="Infra">Infra</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-slate-400">기술 스택 (쉼표 구분)</label>
          <input
            type="text"
            placeholder="예: Node.js, BullMQ, FCM"
            value={newTechStack}
            onChange={(e) => setNewTechStack(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white"
          />
        </div>

        <div>
          <label className="text-[10px] text-slate-400">역할 및 설명</label>
          <input
            type="text"
            placeholder="컴포넌트의 핵심 책임 기술..."
            value={newNodeDesc}
            onChange={(e) => setNewNodeDesc(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="submit"
            disabled={!newNodeName.trim()}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-xs font-semibold"
          >
            노드 생성
          </button>
        </div>
      </form>
    </div>
  );
};
