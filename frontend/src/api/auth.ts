export interface AuthUser {
  id: string;
  loginId: string;
  displayName: string;
}

interface TokenResponse {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
}

export class AuthError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

export class AuthClient {
  // AT는 이 인스턴스의 메모리에만 보관합니다. RT는 브라우저의 HttpOnly 쿠키입니다.
  private accessToken: string | null = null;
  private refreshPending: Promise<AuthUser> | null = null;
  private generation = 0;
  private userId: string | null = null;

  constructor(private readonly transport: typeof fetch = (...args) => fetch(...args)) {}

  private async json<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.transport(`/api/auth/${path}`, {
      ...init, credentials: 'same-origin', cache: 'no-store',
    });
    const body = await response.json();
    if (!response.ok) throw new AuthError(body.error?.code ?? 'AUTH_REQUEST_FAILED', response.status);
    return body.data as T;
  }

  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    // 같은 출처의 여러 탭이 공유 RT를 동시에 회전하지 않도록 직렬화합니다.
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request('syncarch-auth-cookie', operation);
    }
    return operation();
  }

  async login(loginId: string, password: string): Promise<AuthUser> {
    const generation = ++this.generation;
    this.accessToken = null;
    this.userId = null;
    return this.exclusive(async () => {
      const result = await this.json<TokenResponse>('login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password }),
      });
      if (generation !== this.generation) throw new AuthError('SESSION_CHANGED', 401);
      this.accessToken = result.accessToken;
      this.userId = result.user.id;
      return result.user;
    });
  }

  refresh(): Promise<AuthUser> {
    if (this.refreshPending) return this.refreshPending;
    const generation = this.generation;
    const expectedUserId = this.userId;
    const operation = this.exclusive(async () => {
      // 잠금을 얻은 뒤 최신 쿠키에 대응하는 CSRF 값을 조회합니다.
      const { csrfToken } = await this.json<{ csrfToken: string }>('csrf');
      const result = await this.json<TokenResponse>('refresh', {
        method: 'POST', headers: { 'X-CSRF-TOKEN': csrfToken },
      });
      if (generation !== this.generation) throw new AuthError('SESSION_CHANGED', 401);
      // [구글 로그인] 공유 RT 쿠키가 다른 계정으로 바뀌어도 이전 화면의 쓰기를 그 계정 이름으로 재전송하지 않는다.
      if (expectedUserId && result.user.id !== expectedUserId) throw new AuthError('ACCOUNT_CHANGED', 401);
      this.accessToken = result.accessToken;
      this.userId = result.user.id;
      return result.user;
    }).catch((error: unknown) => {
      if (generation === this.generation) this.accessToken = null;
      throw error;
    });
    const pending = operation.finally(() => {
      if (this.refreshPending === pending) this.refreshPending = null;
    });
    this.refreshPending = pending;
    return pending;
  }

  async me(): Promise<AuthUser> {
    if (!this.accessToken) await this.refresh();
    try {
      return await this.json<AuthUser>('me', { headers: this.authorization() });
    } catch (error) {
      if (!(error instanceof AuthError) || error.status !== 401) throw error;
      await this.refresh();
      return this.json<AuthUser>('me', { headers: this.authorization() });
    }
  }

  authorization(): Record<string, string> {
    return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {};
  }

  sessionVersion(): number {
    return this.generation;
  }

  async logout(): Promise<void> {
    ++this.generation;
    this.accessToken = null;
    await this.exclusive(async () => {
      const { csrfToken } = await this.json<{ csrfToken: string }>('csrf');
      await this.json('logout', { method: 'POST', headers: { 'X-CSRF-TOKEN': csrfToken } });
    });
  }
}

export const authClient = new AuthClient();
