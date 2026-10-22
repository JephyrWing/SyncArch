import React, { useState } from 'react';
import { Check, Copy, KeyRound, RefreshCw, X } from 'lucide-react';
import { fetchInviteCode, regenerateInviteCode } from '../api/projects.ts';
import { isAccessError, type ProjectAccess } from '../hooks/useProjectAccess.ts';

/** [초대 코드] 화면에는 읽기 쉽게 ABCD-2345로 보여 준다. 서버는 하이픈 없이 받아도 된다. */
const pretty = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** [초대 코드] 팀장 헤더 버튼. 코드를 보고 복사하고, 새어 나갔으면 재발급한다. */
export const InviteButton: React.FC<{ projectId: string; access: ProjectAccess; disabled?: boolean }> = ({ projectId, access, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle');
  const [error, setError] = useState('');

  const load = async (action: () => Promise<string>) => {
    // [초대 코드] 요청이 겹치면 늦게 온 옛 코드가 화면에 남을 수 있어 한 번에 하나만 보낸다.
    if (disabled || state === 'loading' || access.isStopped()) return;
    setState('loading');
    try {
      const next = await action();
      if (access.isStopped()) return;
      setCode(next);
      setState('idle');
    } catch (err) {
      if (isAccessError(err)) access.stop(err);
      setError((err as Error).message);
      setState('error');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pretty(code));
      setState('copied');
      window.setTimeout(() => setState('idle'), 1500);
    } catch {
      // [초대 코드] 클립보드 권한이 없으면 화면의 코드를 직접 보고 전달하면 된다.
      setError('복사하지 못했습니다. 코드를 직접 전달하세요.');
    }
  };

  return (
    <div className="relative">
      <button
        disabled={disabled || access.isStopped()}
        onClick={() => {
          setOpen(!open);
          if (!open && !code) load(() => fetchInviteCode(projectId));
        }}
        className="flex items-center gap-1 rounded-lg border border-amber-600/50 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20"
        title="팀원에게 보낼 초대 코드"
        aria-expanded={open && !disabled}
      >
        <KeyRound className="h-3.5 w-3.5" />
        <span className="hidden md:inline">초대 코드</span>
      </button>
      {open && !disabled && (
        <div className="absolute right-0 top-9 z-50 w-72 space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white">팀원 초대 (팀장 전용)</span>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white" aria-label="닫기">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-slate-400">이 코드를 팀원에게 보내세요. 팀원은 로그인 후 "참가하기"에 입력하면 편집자로 들어옵니다.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-amber-200">
              {state === 'loading' ? '…' : code ? pretty(code) : '-'}
            </code>
            <button
              onClick={copy}
              disabled={!code || state === 'loading'}
              className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:text-white disabled:opacity-40"
              aria-label="초대 코드 복사"
            >
              {state === 'copied' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <button
            onClick={() => {
              if (window.confirm('새 코드를 만들면 지금 코드로는 더 참가할 수 없습니다. 이미 참가한 팀원은 그대로입니다. 재발급할까요?')) {
                load(() => regenerateInviteCode(projectId));
              }
            }}
            disabled={state === 'loading' || access.isStopped()}
            className="flex items-center gap-1 text-slate-400 hover:text-white disabled:opacity-40"
          >
            <RefreshCw className="h-3 w-3" />
            코드 재발급
          </button>
          {error && <p role="alert" className="text-rose-400">{error}</p>}
        </div>
      )}
    </div>
  );
};
