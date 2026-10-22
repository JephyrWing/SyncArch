import React, { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { RegisterScreen } from './RegisterScreen.tsx';
import { AuthError } from '../api/auth.ts';
import { fetchAuthOptions, loginWithPassword, startGoogleLogin } from '../api/projects.ts';
import type { SessionUser } from '../types/index.ts';

interface LoginScreenProps {
  onLogin: (user: SessionUser) => void;
  initialError?: string;
}

/** [로그인] 구글 로그인(서버 리다이렉트)과 팀원 계정 로그인. 프로젝트는 멤버에게만 보인다. */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, initialError = '' }) => {
  const [registering, setRegistering] = useState(false);
  const [notice, setNotice] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);

  useEffect(() => {
    fetchAuthOptions().then((options) => setGoogleEnabled(options.googleEnabled)).catch(() => setGoogleEnabled(false));
  }, []);

  const handleGoogle = async () => {
    setBusy(true);
    setError('');
    try {
      // [구글 로그인] 구글 인증 후 서버 콜백이 /auth/callback으로 돌려보낸다.
      window.location.assign(await startGoogleLogin());
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await loginWithPassword(loginId.trim(), password));
    } catch (reason) {
      const failure = reason as AuthError;
      setError(failure.code === 'AUTH_UNAVAILABLE' ? '계정은 유지됩니다. 인증 서버에 연결할 수 없으니 잠시 후 다시 로그인해 주세요.'
        : failure.code === 'DB_UNAVAILABLE' ? '데이터베이스에 연결할 수 없습니다. 잠시 후 다시 로그인해 주세요.'
        : '아이디 또는 비밀번호를 확인하세요.');
      setBusy(false);
    }
  };

  if (registering) return <RegisterScreen onBack={() => setRegistering(false)} onRegistered={(id) => {
    setLoginId(id);
    setPassword('');
    setError('');
    setNotice('회원가입이 완료되었습니다. 비밀번호를 입력해 로그인해 주세요.');
    setRegistering(false);
  }} />;

  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center gap-2 font-bold text-indigo-400">
          <Layers className="h-5 w-5" />
          <span>SyncArch</span>
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-white">팀 설계 공간에 로그인</h1>
          <p className="text-xs text-slate-400">
            아이디어부터 API, 아키텍처, DB 설계까지 팀이 함께 정리합니다.
          </p>
        </div>

        {googleEnabled && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="w-full rounded-full bg-white py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-50"
            >
              Google 계정으로 로그인
            </button>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <div className="h-px flex-1 bg-slate-800" />
              <span>또는 팀원 계정</span>
              <div className="h-px flex-1 bg-slate-800" />
            </div>
          </>
        )}

        {notice && <p role="status" className="text-xs text-emerald-300">{notice}</p>}
        <form onSubmit={handlePassword} className="space-y-2">
          <input
            type="text"
            autoComplete="username"
            placeholder="아이디"
            aria-label="아이디"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            required
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호"
            aria-label="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? '로그인하는 중…' : '로그인'}
          </button>
        </form>

        {error && (
          <p role="alert" className="text-xs text-rose-400">
            {error}
          </p>
        )}
        <button type="button" disabled={busy} onClick={() => { setError(''); setNotice(''); setRegistering(true); }} className="w-full text-sm text-indigo-300 disabled:opacity-50">처음이라면 회원가입</button>
        <p className="text-[11px] text-slate-500">처음이라면 회원가입 후 로그인하고, 상단 Google 연결에서 비밀번호를 확인해 주세요.</p>
        <p className="text-[11px] text-slate-500">팀원이라면 팀장에게 초대 코드를 받아, 로그인 후 "참가하기"에 입력하세요.</p>
      </div>
    </div>
  );
};
