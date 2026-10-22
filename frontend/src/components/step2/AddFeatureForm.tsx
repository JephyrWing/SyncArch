import React, { useState } from 'react';
import type { FeatureProgressStatus, FeatureSpec, HttpMethod, PriorityLevel, TeamMember } from '../../types/index.ts';

interface AddFeatureFormProps {
  open: boolean;
  teamMembers: TeamMember[];
  isLocked: boolean;
  onAddFeature: (feature: Omit<FeatureSpec, 'id'>) => void;
  onClose: () => void;
}

// [기능 명세] 닫혀도 마운트를 유지해 다시 열 때 입력값이 남는다(분리 전 동작 유지).
export const AddFeatureForm: React.FC<AddFeatureFormProps> = ({ open, teamMembers, isLocked, onAddFeature, onClose }) => {
  // [기능 명세] 새 기능 입력 상태
  const [newDomain, setNewDomain] = useState('스터디 관리');
  const [newName, setNewName] = useState('');
  const [newPriority, setNewPriority] = useState<PriorityLevel>('P0');
  const [newAssignee, setNewAssignee] = useState(teamMembers[0]?.name || '현우');
  const [newMethod, setNewMethod] = useState<HttpMethod>('POST');
  const [newEndpoint, setNewEndpoint] = useState('/api/v1/');
  const [newReq, setNewReq] = useState('');
  const [newRes, setNewRes] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newStatus, setNewStatus] = useState<FeatureProgressStatus>('PLANNED');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || isLocked) return;

    onAddFeature({
      domain: newDomain.trim() || '공통',
      name: newName.trim(),
      priority: newPriority,
      assignee: newAssignee,
      method: newMethod,
      endpoint: newEndpoint.trim(),
      requestFields: newReq.trim() || 'None',
      responseFields: newRes.trim() || '{ success: boolean }',
      summary: newSummary.trim() || newName.trim(),
      status: newStatus,
      responseStatusCodes: ['200 OK', '400 Bad Request', '401 Unauthorized', '500 Server Error'],
    });

    setNewName('');
    setNewReq('');
    setNewRes('');
    setNewSummary('');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="p-3 border-b border-slate-800 bg-slate-950/90 animate-in fade-in duration-100 shrink-0">
      <form onSubmit={handleCreateSubmit} className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
          <span>신규 기능 &amp; API 엔드포인트 등록</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-[11px]"
          >
            닫기
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] text-slate-400">도메인</label>
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">우선순위</label>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
            >
              <option value="P0">P0 (필수)</option>
              <option value="P1">P1 (주요)</option>
              <option value="P2">P2 (부가)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-400">진행상황</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as FeatureProgressStatus)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
            >
              <option value="PLANNED">계획</option>
              <option value="IN_PROGRESS">진행중</option>
              <option value="QA">QA 검증</option>
              <option value="COMPLETED">완료됨</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-400">담당자</label>
            <select
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
            >
              {teamMembers.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name} ({m.badge})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-slate-400">기능명</label>
          <input
            type="text"
            placeholder="예: 실시간 QR 출석 체크"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-slate-400">HTTP 메서드</label>
            <select
              value={newMethod}
              onChange={(e) => setNewMethod(e.target.value as HttpMethod)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-slate-400">엔드포인트 경로</label>
            <input
              type="text"
              value={newEndpoint}
              onChange={(e) => setNewEndpoint(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-400">Request Fields</label>
            <input
              type="text"
              placeholder="study_id: UUID, code: string"
              value={newReq}
              onChange={(e) => setNewReq(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">Response Fields</label>
            <input
              type="text"
              placeholder="attendance_id: UUID, status: string"
              value={newRes}
              onChange={(e) => setNewRes(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="submit"
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
          >
            기능 등록
          </button>
        </div>
      </form>
    </div>
  );
};
