import React, { useState } from 'react';
import { Server, X } from 'lucide-react';
import type { ArchCategory, ArchNode } from '../../types/index.ts';
import { changedFields } from '../../utils/architecture.ts';

type AssignedTeam = NonNullable<ArchNode['assignedTeam']>;

interface EditNodeModalProps {
  node: ArchNode;
  onSave: (updated: Partial<ArchNode>) => void;
  onClose: () => void;
}

// [시스템 아키텍처] 노드 속성 편집(TC-ARCH-01). id와 좌표는 그대로 두어 연결선과 팀원 병합이 유지된다.
export const EditNodeModal: React.FC<EditNodeModalProps> = ({ node, onSave, onClose }) => {
  // [시스템 아키텍처] 연 시점의 폼 값. 폴링으로 node가 바뀌어도 이것과 비교해 내가 고친 필드만 보낸다.
  const [opened] = useState(() => ({
    name: node.name.trim(),
    category: node.category,
    assignedTeam: node.assignedTeam,
    techStack: node.techStack,
    description: (node.description || '').trim(),
  }));
  const [name, setName] = useState(opened.name);
  const [category, setCategory] = useState<ArchCategory>(opened.category);
  const [assignedTeam, setAssignedTeam] = useState<AssignedTeam | ''>(opened.assignedTeam ?? '');
  const [techStack, setTechStack] = useState(opened.techStack.join(', '));
  const [description, setDescription] = useState(opened.description);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const patch = changedFields(opened, {
      name: name.trim(),
      category,
      assignedTeam: assignedTeam || undefined,
      techStack: techStack.split(',').map((s) => s.trim()).filter(Boolean),
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
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">아키텍처 노드 속성 편집</h4>
              <p className="text-[11px] text-slate-400 font-mono">
                ID 보존: {node.id} (좌표 및 기존 연결관계 유지)
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
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-300">컴포넌트 이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300">계층 (Category)</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ArchCategory)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Client">Client</option>
                <option value="Service">Service</option>
                <option value="Messaging">Messaging</option>
                <option value="DataStore">DataStore</option>
                <option value="Infra">Infra</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300">담당 조직</label>
              <select
                value={assignedTeam}
                onChange={(e) => setAssignedTeam(e.target.value as AssignedTeam)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="" disabled>미지정</option>
                <option value="Backend">Backend</option>
                <option value="Frontend">Frontend</option>
                <option value="Infra">Infra</option>
                <option value="Common">Common</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300">기술 스택 (쉼표로 구분)</label>
            <input
              type="text"
              placeholder="예: React 19, TypeScript, Vite"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300">역할 및 상세 설명 (description)</label>
            <textarea
              rows={3}
              placeholder="컴포넌트의 책임과 역할을 기술합니다."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
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
              disabled={!name.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors shadow-lg shadow-indigo-600/20"
            >
              속성 저장 (ID 보존)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
