import type { ClanMemberDetail, ClanRosterPayload, CwlPayload, HistoryItem } from '../shared/cwl';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

type ApiRequestOptions = RequestInit & {
  timeoutMs?: number;
};

type ApiErrorPayload = {
  error?: string;
  detail?: string;
};

export class ApiError extends Error {
  detail?: string;
  path: string;
  status: number;

  constructor(message: string, status: number, path: string, detail?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
    this.detail = detail;
  }
}

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { timeoutMs, signal, ...fetchOptions } = options;
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const headers = new Headers(fetchOptions.headers);
    if (fetchOptions.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      credentials: 'include',
      headers,
      signal: controller?.signal ?? signal
    });
    const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
    if (!response.ok) {
      throw new ApiError(
        payload.error || `Falha na requisição (${response.status}).`,
        response.status,
        path,
        payload.detail
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error).name === 'AbortError') {
      throw new ApiError(
        'O servidor demorou para responder.',
        408,
        path,
        'Se a API estiver na Render gratuita, ela pode estar acordando. Aguarde alguns segundos e tente novamente.'
      );
    }
    throw new ApiError(
      'Não foi possível conectar ao servidor.',
      0,
      path,
      'Confira se a API está rodando e se a variável VITE_API_URL aponta para o backend correto.'
    );
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export const api = {
  health: (timeoutMs = 5000) => request<{ ok: boolean; sheetsConfigured: boolean }>(
    '/api/health',
    { timeoutMs }
  ),
  session: () => request<{ authenticated: boolean }>('/api/auth/session'),
  login: (password: string) => request<{ authenticated: boolean }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password })
  }),
  logout: () => request<{ authenticated: boolean }>('/api/auth/logout', { method: 'POST' }),
  config: () => request<{ clanTag: string; sheetsConfigured: boolean }>('/api/config'),
  roster: () => request<ClanRosterPayload>('/api/clan/roster'),
  member: (playerTag: string) => request<ClanMemberDetail>(
    `/api/clan/members/${encodeURIComponent(playerTag)}`
  ),
  currentCwl: () => request<CwlPayload>('/api/cwl/current'),
  syncCwl: () => request<CwlPayload>('/api/cwl/sync', { method: 'POST' }),
  history: () => request<{ configured: boolean; items: HistoryItem[] }>('/api/cwl/history')
};
