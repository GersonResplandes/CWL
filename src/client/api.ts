import type { ClanRosterPayload, CwlPayload, HistoryItem } from '../shared/cwl';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Falha na requisição (${response.status}).`);
  return payload as T;
}

export const api = {
  session: () => request<{ authenticated: boolean }>('/api/auth/session'),
  login: (password: string) => request<{ authenticated: boolean }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password })
  }),
  logout: () => request<{ authenticated: boolean }>('/api/auth/logout', { method: 'POST' }),
  config: () => request<{ clanTag: string; sheetsConfigured: boolean }>('/api/config'),
  roster: () => request<ClanRosterPayload>('/api/clan/roster'),
  currentCwl: () => request<CwlPayload>('/api/cwl/current'),
  syncCwl: () => request<CwlPayload>('/api/cwl/sync', { method: 'POST' }),
  history: () => request<{ configured: boolean; items: HistoryItem[] }>('/api/cwl/history')
};
