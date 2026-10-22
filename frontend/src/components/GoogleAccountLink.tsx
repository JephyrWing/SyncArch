import React, { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client.ts';
import { fetchAuthOptions, startGoogleLink } from '../api/projects.ts';

/** [구글 로그인] 비밀번호와 Google 계정 소유권을 같은 연결 흐름에서 확인한다. */
export const GoogleAccountLink: React.FC<{ canNavigate?: () => boolean }> = ({ canNavigate = () => true }) => {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  useEffect(() => {
    let alive = true;
    fetchAuthOptions().then((options) => { if (alive) setEnabled(options.googleEnabled); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending.current) return;
    if (!canNavigate()) { setError('저장되지 않은 변경이 있습니다. 저장을 마친 뒤 연결해 주세요.'); return; }
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const url = await startGoogleLink(password);
      // [구글 로그인] 요청 중 편집이 생기면 이동을 중단해 미저장 초안을 지킨다.
      if (!canNavigate()) { setError('저장되지 않은 변경이 있습니다. 저장을 마친 뒤 연결해 주세요.'); return; }
      setPassword('');
      window.location.assign(url);
    } catch (reason) {
      const failure = reason as ApiError;
      setError(failure.code === 'AUTH_REQUIRED' ? '비밀번호 또는 로그인 상태를 확인해 주세요.' : failure.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  if (!enabled) return null;
  return <>
    <button type="button" onClick={() => { setPassword(''); setError(''); setOpen(true); }} className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:text-white">Google 연결</button>
    {open && <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/80 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="google-link-title" className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-sm text-slate-100">
        <h2 id="google-link-title" className="font-bold">Google 계정 연결</h2>
        <p className="text-xs text-slate-400">현재 SyncArch 계정의 비밀번호를 확인한 뒤 연결할 Google 계정을 선택합니다. 이메일을 등록하는 것만으로 연결되지는 않습니다.</p>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">SyncArch 비밀번호
            <input aria-label="Google 연결 비밀번호" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2" />
          </label>
          {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-indigo-600 p-2 font-bold disabled:opacity-50">{busy ? '확인하는 중…' : '비밀번호 확인 후 Google 연결'}</button>
        </form>
        <button type="button" disabled={busy} onClick={() => { setPassword(''); setOpen(false); }} className="w-full text-slate-300">취소</button>
      </section>
    </div>}
  </>;
};
