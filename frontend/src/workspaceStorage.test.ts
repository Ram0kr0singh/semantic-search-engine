import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetMemoryStorage,
  clearStoredWorkspaceLimits,
  clearStoredWorkspaceToken,
  clearWorkspaceSession,
  getStoredWorkspaceLimits,
  getStoredWorkspaceToken,
  setStoredWorkspaceLimits,
  setStoredWorkspaceToken,
} from './workspaceStorage';

describe('workspaceStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    _resetMemoryStorage();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
    _resetMemoryStorage();
    vi.restoreAllMocks();
  });

  it('persists and retrieves workspace token and limits in normal sessionStorage', () => {
    expect(getStoredWorkspaceToken()).toBeNull();
    expect(getStoredWorkspaceLimits()).toBeNull();

    setStoredWorkspaceToken('token-12345');
    expect(getStoredWorkspaceToken()).toBe('token-12345');

    const limits = {
      max_upload_mb: 15,
      max_files_per_workspace: 8,
      max_pdf_pages: 150,
      max_chars_per_document: 500000,
      max_passages_per_workspace: 2000,
    };
    setStoredWorkspaceLimits(limits);
    expect(getStoredWorkspaceLimits()).toEqual(limits);

    clearStoredWorkspaceToken();
    expect(getStoredWorkspaceToken()).toBeNull();
    expect(getStoredWorkspaceLimits()).toEqual(limits);

    clearStoredWorkspaceLimits();
    expect(getStoredWorkspaceLimits()).toBeNull();

    setStoredWorkspaceToken('token-abc');
    setStoredWorkspaceLimits(limits);
    clearWorkspaceSession();
    expect(getStoredWorkspaceToken()).toBeNull();
    expect(getStoredWorkspaceLimits()).toBeNull();
  });

  it('falls back seamlessly to in-memory storage when sessionStorage access throws (blocked storage)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: The operation is insecure.');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: The operation is insecure.');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError: The operation is insecure.');
    });

    // Should not throw and should store in memory
    expect(() => setStoredWorkspaceToken('memory-token-xyz')).not.toThrow();
    expect(getStoredWorkspaceToken()).toBe('memory-token-xyz');

    const limits = {
      max_upload_mb: 20,
      max_files_per_workspace: 12,
      max_pdf_pages: 300,
      max_chars_per_document: 1000000,
      max_passages_per_workspace: 4000,
    };
    expect(() => setStoredWorkspaceLimits(limits)).not.toThrow();
    expect(getStoredWorkspaceLimits()).toEqual(limits);

    expect(() => clearWorkspaceSession()).not.toThrow();
    expect(getStoredWorkspaceToken()).toBeNull();
    expect(getStoredWorkspaceLimits()).toBeNull();
  });
});
