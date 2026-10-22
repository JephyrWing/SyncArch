import React, { useRef, useState } from 'react';
import { ApiError } from '../api/client.ts';
import { registerAccount } from '../api/projects.ts';

interface RegisterScreenProps {
  onRegistered: (loginId: string) => void;
  onBack: () => void;
}

/** [구글 로그인] 가입 성공은 계정 생성만 알리고 기존 로그인 화면으로 돌아간다. */
export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onRegistered, onBack }) => {
  const [loginId, setLoginId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    if (!loginId.trim() || !displayName.trim()) {
      setError('아이디와 이름을 입력해 주세요.');
      return;
    }
    if (Array.from(password).length < 8 || Array.from(password).length > 128) {
      setError('새 비밀번호는 8~128자로 입력해 주세요.');
      return;
    }
    if (password !== confirmation) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const user = await registerAccount({ loginId: loginId.trim(), displayName: displayName.trim(), password,
        ...(email.trim() ? { email: email.trim() } : {}) });
      setPassword('');
      setConfirmation('');
      onRegistered(user.loginId);
    } catch (reason) {
      const failure = reason as ApiError;
      const messages: Record<string, string> = {
        REGISTRATION_CONFLICT: '이미 사용 중인 아이디 또는 이메일입니다. 기존 계정으로 로그인하거나 다른 정보를 입력해 주세요.',
        DB_UNAVAILABLE: '회원가입을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        NETWORK_ERROR: '가입 결과를 확인할 수 없습니다. 로그인으로 가입 여부를 확인한 뒤 다시 시도해 주세요.',
      };
      setError(messages[failure.code] ?? failure.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const input = 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white focus:border-indigo-500 focus:outline-none';
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      <section className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-lg font-bold text-white">SyncArch 회원가입</h1>
        <p className="text-xs text-slate-400">계정을 만든 뒤 로그인해 프로젝트를 만들거나 초대 코드로 참여하세요.</p>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs">아이디 (필수)
            <input aria-label="가입 아이디" autoComplete="username" required maxLength={100} value={loginId} onChange={(e) => setLoginId(e.target.value)} disabled={busy} className={input} />
          </label>
          <label className="block text-xs">이름 (필수)
            <input aria-label="이름" autoComplete="nickname" required maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={busy} className={input} />
          </label>
          <label className="block text-xs">이메일 (선택)
            <input aria-label="가입 이메일" type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} className={input} />
          </label>
          <p className="text-[11px] text-slate-400">이메일은 나중에 추가해도 됩니다. Google 연결은 로그인 후 별도로 진행합니다.</p>
          <label className="block text-xs">비밀번호 (필수, 8~128자)
            <input aria-label="가입 비밀번호" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} className={input} />
          </label>
          <label className="block text-xs">비밀번호 확인 (필수)
            <input aria-label="비밀번호 확인" type="password" autoComplete="new-password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={busy} className={input} />
          </label>
          {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? '가입하는 중…' : '회원가입 완료'}</button>
        </form>
        <button type="button" onClick={onBack} disabled={busy} className="w-full text-sm text-indigo-300 disabled:opacity-50">로그인으로 돌아가기</button>
      </section>
    </div>
  );
};
