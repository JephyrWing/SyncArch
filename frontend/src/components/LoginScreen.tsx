import React, { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { fetchGoogleClientId, loginWithGoogle } from '../api/projects.ts';
import type { SessionUser } from '../types/index.ts';

// [구글 로그인] Google Identity Services에 필요한 최소 타입(https://developers.google.com/identity/gsi/web).
interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

const loadGoogleScript = (): Promise<GoogleIdentity> =>
  new Promise((resolve, reject) => {
    if (window.google) return resolve(window.google);
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error('google')));
    script.onerror = () => reject(new Error('google'));
    document.head.appendChild(script);
  });

interface LoginScreenProps {
  onLogin: (user: SessionUser) => void;
}

/** [구글 로그인] 로그인은 구글만 쓴다(팀 결정). 구글 계정이면 누구나 로그인하고 프로젝트는 멤버에게만 보인다. */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unconfigured' | 'signing-in'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const clientId = await fetchGoogleClientId();
        if (!clientId) {
          if (!cancelled) setState('unconfigured');
          return;
        }
        const google = await loadGoogleScript();
        if (cancelled || !buttonRef.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            setState('signing-in');
            setError('');
            try {
              onLogin(await loginWithGoogle(credential));
            } catch (err) {
              setError((err as Error).message);
              setState('ready');
            }
          },
        });
        google.accounts.id.renderButton(buttonRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          locale: 'ko',
          width: 300,
        });
        setState('ready');
      } catch (err) {
        if (cancelled) return;
        setError(
          (err as Error).message === 'google'
            ? '구글 로그인 버튼을 불러오지 못했습니다. 인터넷 연결이나 광고 차단 확장 프로그램을 확인한 뒤 새로고침하세요.'
            : (err as Error).message
        );
        setState('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onLogin]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center gap-2 font-bold text-indigo-400">
          <Layers className="h-5 w-5" />
          <span>SyncArch</span>
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-white">팀 설계 공간에 로그인</h1>
          <p className="text-xs text-slate-400">
            아이디어부터 API, 아키텍처, DB 설계까지 팀이 함께 정리합니다. 구글 계정으로 로그인하세요.
          </p>
        </div>

        {state === 'unconfigured' ? (
          <p role="alert" className="rounded-lg border border-amber-700/60 bg-amber-950/60 p-3 text-xs text-amber-200">
            구글 로그인이 아직 설정되지 않았습니다. 서버의 <code>backend/.env</code>에 <code>GOOGLE_CLIENT_ID</code>를 넣고 서버를 다시 시작하세요.
          </p>
        ) : (
          <div className="flex min-h-[44px] flex-col items-center justify-center gap-2">
            <div ref={buttonRef} aria-label="Google 계정으로 로그인" />
            {state === 'loading' && <span className="text-xs text-slate-400">로그인 버튼을 불러오는 중…</span>}
            {state === 'signing-in' && <span className="text-xs text-slate-400">로그인하는 중…</span>}
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs text-rose-400">
            {error}
          </p>
        )}
        <p className="text-[11px] text-slate-500">팀원이라면 팀장에게 초대 코드를 받아, 로그인 후 "참가하기"에 입력하세요.</p>
      </div>
    </div>
  );
};
