// src/lib/api.ts — appels au serveur RHEMA Business (mode VITE_BACKEND=api).
import type { User } from '../types';

export const SESSION_EXPIRED_EVENT = 'rhema:session-expired';

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, message: string, body?: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T = any>(
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  body?: unknown,
  options: { keepalive?: boolean; signalExpired?: boolean } = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      keepalive: options.keepalive,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Serveur injoignable. Vérifiez la connexion réseau.');
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* réponse sans JSON */
  }
  if (!res.ok) {
    if (res.status === 401 && options.signalExpired !== false) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(res.status, json?.error || `Erreur serveur (${res.status}).`, json);
  }
  return json as T;
}

export interface PublicStatus {
  initialized: boolean;
  setupCodeRequired: boolean;
  organization: { id: string; name: string; logo?: string; registrationNumber?: string; type?: string } | null;
}

export interface LoginResponse {
  user: User;
  mustChangePassword: boolean;
}

export const api = {
  status: () => apiFetch<PublicStatus>('GET', '/api/public/status'),
  me: () => apiFetch<LoginResponse>('GET', '/api/auth/me', undefined, { signalExpired: false }),
  login: (identifier: string, password: string) =>
    apiFetch<LoginResponse>('POST', '/api/auth/login', { identifier, password }, { signalExpired: false }),
  changePassword: (newPassword: string, currentPassword?: string) =>
    apiFetch<{ user: User }>('POST', '/api/auth/change-password', { newPassword, currentPassword }),
  logout: () => apiFetch('POST', '/api/auth/logout', {}, { signalExpired: false }),
  setup: (payload: { setupCode: string; users: unknown[]; data: Record<string, unknown> }) =>
    apiFetch<{ ok: boolean }>('POST', '/api/setup', payload),
  exportBackup: () => apiFetch<any>('GET', '/api/data/export'),
  importBackup: (backup: unknown) => apiFetch<{ ok: boolean; relogin: boolean }>('POST', '/api/data/import', backup),
};
