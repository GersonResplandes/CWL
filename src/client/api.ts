import type { ClanMemberDetail, ClanRosterPayload, CwlPayload, HistoryItem } from '../shared/cwl';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

type ApiRequestOptions = RequestInit & {
  timeoutMs?: number;
};

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { timeoutMs, signal, ...fetchOptions } = options;
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers
      },
      signal: controller?.signal ?? signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha na requisição (${response.status}).`);
    return payload as T;
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
