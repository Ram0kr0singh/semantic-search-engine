import type { WorkspaceLimits } from './api';

const TOKEN_KEY = 'semantic_search_workspace_token';
const LIMITS_KEY = 'semantic_search_workspace_limits';

// In-memory fallback if sessionStorage is blocked, restricted, or throws
let memoryStorage: Record<string, string> = {};

function safeGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return memoryStorage[key] ?? null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    memoryStorage[key] = value;
  }
}

function safeRemove(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    delete memoryStorage[key];
  }
}

export function getStoredWorkspaceToken(): string | null {
  return safeGet(TOKEN_KEY);
}

export function setStoredWorkspaceToken(token: string): void {
  safeSet(TOKEN_KEY, token);
}

export function clearStoredWorkspaceToken(): void {
  safeRemove(TOKEN_KEY);
}

export function getStoredWorkspaceLimits(): WorkspaceLimits | null {
  const raw = safeGet(LIMITS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkspaceLimits;
  } catch {
    return null;
  }
}

export function setStoredWorkspaceLimits(limits: WorkspaceLimits): void {
  safeSet(LIMITS_KEY, JSON.stringify(limits));
}

export function clearStoredWorkspaceLimits(): void {
  safeRemove(LIMITS_KEY);
}

export function clearWorkspaceSession(): void {
  clearStoredWorkspaceToken();
  clearStoredWorkspaceLimits();
}

export function _resetMemoryStorage(): void {
  memoryStorage = {};
}
