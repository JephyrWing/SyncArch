import React, { useRef, useState } from 'react';
import { Mail, X } from 'lucide-react';
import { ApiError } from '../api/client.ts';
import { saveEmail } from '../api/projects.ts';

/** [구글 로그인] 편집 화면을 유지한 채 본인 계정의 이메일을 등록하거나 수정한다. */
export const AccountSettings: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      setSaved(await saveEmail(email.trim(), password));
      setPassword('');
    } catch (reason) {
      const failure = reason as ApiError;
      const messages: Record<string, string> = {
        AUTH_REQUIRED: '비밀번호 또는 로그인 상태를 확인해 주세요.',
        IDENTITY_CONFLICT: '이미 사용 중이거나 연결된 계정과 충돌하는 이메일입니다. 다른 주소를 입력해 주세요.',
        AUTH_UNAVAILABLE: '인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
        DB_UNAVAILABLE: '이메일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      };
      setError(messages[failure.code] ?? failure.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const close = () => {
    if (busyRef.current) return;
    setPassword('');
    setError('');
    setOpen(false);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="이메일 등록/수정" className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:text-white">
        <Mail className="h-3.5 w-3.5" /><span className="hidden sm:inline">이메일</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="email-settings-title" className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-sm text-slate-100 shadow-2xl">
            <header className="mb-3 flex items-center justify-between">
              <h2 id="email-settings-title" className="font-bold">이메일 등록/수정</h2>
              <button type="button" onClick={close} disabled={busy} aria-label="이메일 설정 닫기"><X className="h-4 w-4" /></button>
            </header>
            <p className="mb-4 text-xs text-slate-400">본인 계정의 비밀번호로 확인한 뒤 바로 저장합니다. 같은 이메일의 Google 계정을 연결할 때 사용합니다.</p>
            <form onSubmit={submit} className="space-y-3">
              <label className="block">이메일 주소
                <input autoFocus type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => { setEmail(e.target.value); setSaved(''); }} disabled={busy} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2" />
              </label>
              <label className="block">본인 비밀번호
                <input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2" />
              </label>
              {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
              {saved && <p role="status" className="text-xs text-emerald-300">{saved} 주소를 저장했습니다.</p>}
              <button type="submit" disabled={busy || !email.trim() || !password} className="w-full rounded-lg bg-indigo-600 p-2 font-bold text-white disabled:opacity-50">{busy ? '저장 중…' : '이메일 저장'}</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
};
