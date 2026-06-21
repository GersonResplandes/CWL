import type { CwlPayload, HistoryItem } from '../shared/cwl.js';
import { scoreWarEntry } from '../shared/scoring.js';

type AppsScriptResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export function createSheetsService(url?: string, secret?: string) {
  const configured = Boolean(url && secret);

  async function request<T>(action: string, payload: unknown): Promise<T> {
    if (!url || !secret) throw new Error('Google Sheets ainda não está configurado.');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret, action, payload })
    });
    const result = await response.json() as AppsScriptResponse<T>;
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Falha na comunicação com o Google Sheets.');
    }
    return result.data as T;
  }

  async function saveCwl(cwl: CwlPayload) {
    const payload: CwlPayload = {
      ...cwl,
      players: cwl.players.map(player => ({
        ...player,
        wars: player.wars.map(entry => ({
          ...scoreWarEntry(player, entry)
        }))
      }))
    };
    await request('saveCwl', payload);
    return true;
  }

  async function listCwls(): Promise<HistoryItem[]> {
    if (!configured) return [];
    return request<HistoryItem[]>('listCwls', {});
  }

  async function getCwl(cwlId: string) {
    return request('getCwl', { cwlId });
  }

  async function saveAdjustment(payload: unknown) {
    return request('saveAdjustment', payload);
  }

  return { configured, getCwl, listCwls, saveAdjustment, saveCwl };
}
