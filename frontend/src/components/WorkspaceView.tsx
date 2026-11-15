import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import {
  api,
  ApiError,
  type WorkspaceDocSummary,
  type WorkspaceLimits,
  type WorkspaceSearchMethod,
  type WorkspaceSearchResponse,
  type WorkspaceTotals,
} from '../api';
import {
  clearWorkspaceSession,
  getStoredWorkspaceLimits,
  getStoredWorkspaceToken,
  setStoredWorkspaceLimits,
  setStoredWorkspaceToken,
} from '../workspaceStorage';
import {
  formatFileSize,
  formatTimeRemaining,
  formatWorkspaceError,
} from '../workspaceUtils';
import { WorkspaceResultCard } from './WorkspaceResultCard';
import { FilePreviewModal } from './FilePreviewModal';
import { TypewriterHeading } from './brandlove/TypewriterHeading';

interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'queued' | 'uploading' | 'indexing' | 'done' | 'error';
  error: string | null;
  warnings: string[];
}

const SEARCH_METHODS: Array<{
  id: WorkspaceSearchMethod;
  name: string;
  description: string;
}> = [
  {
    id: 'semantic',
    name: 'Meaning match (recommended)',
    description: 'Finds passages with similar meaning, even if they use different words.',
  },
  {
    id: 'bm25',
    name: 'Exact words',
    description: 'Matches the specific words you typed.',
  },
  {
    id: 'hybrid',
    name: 'Meaning + exact words',
    description: 'Combines meaning-based and exact word matching for balanced results.',
  },
  {
    id: 'rerank',
    name: 'Re-ranked (slower, experimental)',
    description: 'Re-checks the top matches with a second model. It can improve or worsen the order depending on the documents.',
  },
];

export function WorkspaceView() {
  const [token, setToken] = useState<string | null>(() => getStoredWorkspaceToken());
  const tokenRef = useRef<string | null>(token);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const [limits, setLimits] = useState<WorkspaceLimits | null>(() => getStoredWorkspaceLimits());
  const [documents, setDocuments] = useState<WorkspaceDocSummary[]>([]);
  const [totals, setTotals] = useState<WorkspaceTotals>({ documents: 0, passages: 0 });
  const [secondsUntilExpiry, setSecondsUntilExpiry] = useState<number | null>(null);

  const [isLoadingSession, setIsLoadingSession] = useState(() => !!getStoredWorkspaceToken());
  const [sessionExpired, setSessionExpired] = useState(false);

  // Upload queue
  const [uploadQueue, setUploadQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  const isProcessingQueueRef = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileObjectsRef = useRef<Map<string, File>>(new Map());

  // File preview state
  const [previewDoc, setPreviewDoc] = useState<{
    name: string;
    kind: string;
    file: File | null;
    metadata?: {
      pages?: number | null;
      passages?: number;
      characters?: number;
    };
  } | null>(null);

  // Deletion state
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isRemovingDoc, setIsRemovingDoc] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Search state (always empty on load)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSubmittedQuery, setSearchSubmittedQuery] = useState('');
  const [searchMethod, setSearchMethod] = useState<WorkspaceSearchMethod>('semantic');
  const [searchK, setSearchK] = useState<number>(5);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResponse, setSearchResponse] = useState<WorkspaceSearchResponse | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchId = useRef(0);

  // Accessible announcements
  const [announcement, setAnnouncement] = useState('');

  // DOM Refs for accessibility and focus management
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const deleteEverythingBtnRef = useRef<HTMLButtonElement>(null);
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);

  // Focus management when confirmation dialog opens
  const prevConfirmDeleteAll = useRef(false);
  useEffect(() => {
    if (confirmDeleteAll) {
      confirmDeleteRef.current?.focus();
    } else if (prevConfirmDeleteAll.current) {
      deleteEverythingBtnRef.current?.focus();
    }
    prevConfirmDeleteAll.current = confirmDeleteAll;
  }, [confirmDeleteAll]);

  // Load existing session on mount
  useEffect(() => {
    const existingToken = getStoredWorkspaceToken();
    if (!existingToken) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const status = await api.workspaceStatus(existingToken);
        if (controller.signal.aborted) return;
        setDocuments(status.documents);
        setTotals(status.totals);
        setSecondsUntilExpiry(status.seconds_until_expiry);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && (err.code === 'workspace_not_found' || err.status === 404)) {
          clearWorkspaceSession();
          setToken(null);
          tokenRef.current = null;
          setDocuments([]);
          setTotals({ documents: 0, passages: 0 });
          setLimits(null);
          setSessionExpired(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSession(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, []);

  // Process the upload queue sequentially
  const processQueue = useCallback(async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;
    setIsUploading(true);

    try {
      while (true) {
        const nextIndex = queueRef.current.findIndex((item) => item.status === 'queued');
        if (nextIndex === -1) break;

        const currentItem = queueRef.current[nextIndex];

        // Ensure workspace is created lazily on the first upload
        let currentToken = tokenRef.current;
        if (!currentToken) {
          try {
            const created = await api.createWorkspace();
            currentToken = created.workspace_id;
            tokenRef.current = currentToken;
            setToken(currentToken);
            setStoredWorkspaceToken(currentToken);
            setLimits(created.limits);
            setStoredWorkspaceLimits(created.limits);
            setSessionExpired(false);
          } catch (createErr) {
            const errMsg = formatWorkspaceError(createErr);
            for (let i = 0; i < queueRef.current.length; i++) {
              if (queueRef.current[i].status === 'queued') {
                queueRef.current[i] = {
                  ...queueRef.current[i],
                  status: 'error',
                  error: errMsg,
                };
              }
            }
            setUploadQueue([...queueRef.current]);
            setAnnouncement(`Upload failed: ${errMsg}`);
            break;
          }
        }

        // Mark as uploading
        queueRef.current[nextIndex] = { ...currentItem, status: 'uploading' };
        setUploadQueue([...queueRef.current]);
        setAnnouncement(`Uploading ${currentItem.name}…`);

        // Brief delay before transitioning to "Reading and indexing"
        const indexingTimeout = setTimeout(() => {
          if (queueRef.current[nextIndex]?.status === 'uploading') {
            queueRef.current[nextIndex] = {
              ...queueRef.current[nextIndex],
              status: 'indexing',
            };
            setUploadQueue([...queueRef.current]);
            setAnnouncement(`Reading and indexing ${currentItem.name}…`);
          }
        }, 150);

        try {
          const doc = await api.uploadWorkspaceDocument(currentToken, currentItem.file);
          clearTimeout(indexingTimeout);
          fileObjectsRef.current.set(doc.id, currentItem.file);
          fileObjectsRef.current.set(doc.name, currentItem.file);

          queueRef.current[nextIndex] = {
            ...currentItem,
            status: 'done',
            warnings: doc.warnings || [],
          };
          setUploadQueue([...queueRef.current]);
          setAnnouncement(`${currentItem.name} uploaded and indexed successfully.`);

          // Update documents state
          setDocuments((prev) => {
            const next = prev.filter((d) => d.id !== doc.id);
            return [...next, doc];
          });

          // Refresh status totals and expiry
          try {
            const refreshed = await api.workspaceStatus(currentToken);
            setDocuments(refreshed.documents);
            setTotals(refreshed.totals);
            setSecondsUntilExpiry(refreshed.seconds_until_expiry);
          } catch {
            // Document already added locally
          }
        } catch (uploadErr) {
          clearTimeout(indexingTimeout);
          const isNotFound =
            uploadErr instanceof ApiError &&
            (uploadErr.code === 'workspace_not_found' || uploadErr.status === 404);

          const errMsg = formatWorkspaceError(uploadErr);
          queueRef.current[nextIndex] = {
            ...currentItem,
            status: 'error',
            error: errMsg,
          };
          setUploadQueue([...queueRef.current]);
          setAnnouncement(`Failed to upload ${currentItem.name}: ${errMsg}`);

          if (isNotFound) {
            clearWorkspaceSession();
            tokenRef.current = null;
            setToken(null);
            setSessionExpired(true);
            for (let i = nextIndex + 1; i < queueRef.current.length; i++) {
              if (queueRef.current[i].status === 'queued') {
                queueRef.current[i] = {
                  ...queueRef.current[i],
                  status: 'error',
                  error: errMsg,
                };
              }
            }
            setUploadQueue([...queueRef.current]);
            break;
          }
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
      setIsUploading(false);
    }
  }, []);

  const enqueueFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      files.forEach((file) => {
        fileObjectsRef.current.set(file.name, file);
      });
      const newItems: QueueItem[] = files.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        status: 'queued',
        error: null,
        warnings: [],
      }));

      queueRef.current = [...queueRef.current, ...newItems];
      setUploadQueue([...queueRef.current]);
      void processQueue();
    },
    [processQueue]
  );

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      enqueueFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isUploading) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (isUploading) return;
    if (e.dataTransfer.files) {
      enqueueFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handlePreviewDocument = (doc: WorkspaceDocSummary) => {
    const file = fileObjectsRef.current.get(doc.id) || fileObjectsRef.current.get(doc.name) || null;
    setPreviewDoc({
      name: doc.name,
      kind: doc.kind,
      file,
      metadata: {
        pages: doc.pages,
        passages: doc.passage_count,
        characters: doc.character_count,
      },
    });
  };

  const handlePreviewQueueItem = (item: QueueItem) => {
    setPreviewDoc({
      name: item.name,
      kind: item.name.split('.').pop() || 'file',
      file: item.file,
    });
  };

  const handleRemoveDocument = async (documentId: string, documentName: string) => {
    if (!token || isUploading) return;
    setIsRemovingDoc(documentId);
    setRemoveError(null);

    try {
      await api.deleteWorkspaceDocument(token, documentId);
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      setAnnouncement(`${documentName} removed.`);
      try {
        const refreshed = await api.workspaceStatus(token);
        setDocuments(refreshed.documents);
        setTotals(refreshed.totals);
        setSecondsUntilExpiry(refreshed.seconds_until_expiry);
      } catch {
        // Document already removed locally
      }
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'workspace_not_found' || err.status === 404)) {
        clearWorkspaceSession();
        tokenRef.current = null;
        setToken(null);
        setDocuments([]);
        setSessionExpired(true);
      } else {
        setRemoveError(formatWorkspaceError(err));
      }
    } finally {
      setIsRemovingDoc(null);
    }
  };

  const handleConfirmDeleteEverything = async () => {
    if (!token || isUploading) {
      setConfirmDeleteAll(false);
      return;
    }
    setIsDeletingAll(true);

    try {
      await api.deleteWorkspace(token);
    } catch {
      // Clear client state even if backend returned an error (e.g. already deleted)
    } finally {
      clearWorkspaceSession();
      tokenRef.current = null;
      setToken(null);
      setDocuments([]);
      setTotals({ documents: 0, passages: 0 });
      setLimits(null);
      setUploadQueue([]);
      fileObjectsRef.current.clear();
      setPreviewDoc(null);
      setSearchResponse(null);
      setSearchQuery('');
      setSearchSubmittedQuery('');
      setConfirmDeleteAll(false);
      setIsDeletingAll(false);
      setAnnouncement('All workspace documents and indexes have been deleted.');
      headingRef.current?.focus();
    }
  };

  const handleSearchSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const formElement = e?.currentTarget as HTMLFormElement | undefined;
    const inputElement = formElement?.elements?.namedItem('workspace-search-input') as HTMLInputElement | null;
    const rawVal = inputElement ? inputElement.value : searchQuery;
    const trimmed = rawVal.trim();
    if (!trimmed || !token || documents.length === 0) return;

    setSearchQuery(trimmed);
    const id = ++searchId.current;
    const controller = api.beginWorkspaceSearch();

    setIsSearching(true);
    setSearchError(null);
    setSearchSubmittedQuery(trimmed);
    setAnnouncement(`Searching documents for "${trimmed}"…`);

    try {
      const res = await api.workspaceSearch(
        token,
        { query: trimmed, method: searchMethod, k: searchK },
        controller
      );
      if (id === searchId.current) {
        setSearchResponse(res);
        setAnnouncement(
          res.results.length > 0
            ? `Found ${res.results.length} matching passage${res.results.length > 1 ? 's' : ''}.`
            : res.message || 'No matching passages found.'
        );
      }
    } catch (err) {
      if (!controller.signal.aborted && id === searchId.current) {
        if (err instanceof ApiError && (err.code === 'workspace_not_found' || err.status === 404)) {
          clearWorkspaceSession();
          tokenRef.current = null;
          setToken(null);
          setDocuments([]);
          setSessionExpired(true);
        } else {
          setSearchError(formatWorkspaceError(err));
          setSearchResponse(null);
        }
        setAnnouncement('Search request failed.');
      }
    } finally {
      if (id === searchId.current) {
        setIsSearching(false);
      }
    }
  };

  const selectedMethodObj = SEARCH_METHODS.find((m) => m.id === searchMethod);

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Screen Reader Announcement */}
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>

      {/* Header & Explanation */}
      <section className="text-center space-y-4 max-w-4xl mx-auto pt-2">
        <TypewriterHeading
          headingRef={headingRef}
          tabIndex={-1}
          lines={['Search your own', 'documents']}
          accessibleTitle="Search your own documents"
          className="font-extrabold uppercase tracking-[0.2em] text-[var(--text)] text-center leading-[1.1] focus:outline-none"
          style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)' }}
        />
        <p className="text-xs sm:text-sm uppercase tracking-wide text-[var(--text-muted)] max-w-2xl mx-auto leading-relaxed font-sans">
          Upload your own PDF, text or Markdown files and search them by meaning.
          Files are not saved to disk by this app. Everything is removed after
          about an hour of inactivity or when you press Delete everything.
        </p>

        {/* Prominent Privacy Notice */}
        <div className="max-w-2xl mx-auto text-left p-4 rounded-sm bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-muted)] leading-relaxed shadow-xl">
          <div className="flex items-start gap-3">
            <span
              className="w-2 h-2 rounded-full bg-[var(--bl-accent-hot,#ff3d5a)] shadow-[0_0_8px_rgba(255,61,90,0.8)] shrink-0 mt-1"
              aria-hidden="true"
            />
            <div>
              <span className="font-mono font-bold uppercase tracking-wider text-[var(--bl-accent-hot,#ff3d5a)]">
                Privacy note:{' '}
              </span>
              Uploaded files are processed in memory by the server running this
              app to extract text and build search indexes. Original files and
              extracted text are not saved to disk by this app. Everything is
              ephemeral and deleted automatically after about an hour of
              inactivity or as soon as you choose to delete everything.
            </div>
          </div>
        </div>

        {/* Expired Session Alert */}
        {sessionExpired && (
          <div
            role="status"
            className="max-w-2xl mx-auto p-4 rounded-sm bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-300 flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1" />
              <span>
                Your session expired after inactivity. Upload files below to
                start a new private workspace.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSessionExpired(false)}
              className="text-xs font-mono uppercase tracking-wider text-amber-400 hover:text-[var(--text)] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </section>

      {/* Drop Zone & Upload Controls */}
      <section className="max-w-2xl mx-auto">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-6 sm:p-8 rounded-sm border-2 border-dashed transition-all text-center space-y-4 bg-[var(--surface)] ${
            isDraggingOver
              ? 'border-[var(--bl-accent-hot,#ff3d5a)] bg-[#ff3d5a]/5 shadow-[0_0_25px_rgba(255,61,90,0.25)]'
              : 'border-[var(--border)] hover:border-[var(--border-accent)]'
          } ${isUploading ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {/* Native hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md,text/plain,application/pdf,text/markdown"
            onChange={handleFileInputChange}
            disabled={isUploading}
            className="sr-only"
            id="workspace-file-input"
            aria-label="Upload PDF, TXT or Markdown files"
          />

          <div
            className="w-10 h-10 mx-auto rounded-full bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-center text-[var(--bl-accent-hot,#ff3d5a)] shadow-xs"
            aria-hidden="true"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <div className="space-y-1">
            <p className="text-sm sm:text-base font-bold uppercase tracking-[0.15em] text-[var(--text)]">
              Drag and drop files here, or browse
            </p>
            <p className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
              Accepted formats: PDF (.pdf), Plain Text (.txt), Markdown (.md)
            </p>
          </div>

          {/* Limits returned from API response */}
          {limits && (
            <div className="pt-1 text-[11px] font-mono text-[var(--text-muted)] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 uppercase">
              <span>Up to {limits.max_upload_mb} MB per file</span>
              <span aria-hidden="true" className="text-[var(--border)]">·</span>
              <span>Up to {limits.max_files_per_workspace} files</span>
              <span aria-hidden="true" className="text-[var(--border)]">·</span>
              <span>Up to {limits.max_pdf_pages} pages per PDF</span>
              <span aria-hidden="true" className="text-[var(--border)]">·</span>
              <span>Up to {limits.max_passages_per_workspace.toLocaleString()} passages</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2.5 rounded-sm text-xs font-bold uppercase tracking-[0.15em] bg-[var(--bl-accent-hot,#ff3d5a)] text-white shadow-md hover:bg-[#ff5c73] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] transition-all"
            >
              {isUploading ? 'Uploading files…' : 'Choose files'}
            </button>
          </div>
        </div>

        {/* Upload Queue Progress */}
        {uploadQueue.length > 0 && (
          <div className="mt-4 p-4 rounded-sm bg-[var(--surface)] border border-[var(--border)] space-y-3">
            <h2 className="text-xs font-bold uppercase font-mono tracking-[0.2em] text-[var(--bl-accent-hot,#ff3d5a)]">
              Upload queue
            </h2>
            <ul className="space-y-2 text-xs divide-y divide-[var(--border-subtle)] font-mono">
              {uploadQueue.map((item) => (
                <li
                  key={item.id}
                  className="pt-2 first:pt-0 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => handlePreviewQueueItem(item)}
                      className="font-medium text-[var(--text)] hover:text-[var(--bl-accent-hot,#ff3d5a)] hover:underline truncate max-w-[200px] sm:max-w-xs text-left cursor-pointer inline-flex items-center gap-1.5 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] rounded-sm"
                      title={`Preview ${item.name}`}
                    >
                      <span>{item.name}</span>
                      <svg
                        className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 text-[var(--bl-accent-hot,#ff3d5a)] shrink-0 transition-opacity"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <span className="text-[var(--text-muted)] font-mono text-[11px]">
                      ({formatFileSize(item.size)})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.status === 'queued' && (
                      <span className="text-[var(--text-muted)] uppercase">Queued</span>
                    )}
                    {item.status === 'uploading' && (
                      <span className="inline-flex items-center gap-1.5 text-[var(--bl-accent-hot,#ff3d5a)] font-semibold animate-pulse uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--bl-accent-hot,#ff3d5a)]" />
                        Uploading
                      </span>
                    )}
                    {item.status === 'indexing' && (
                      <span className="inline-flex items-center gap-1.5 text-[var(--bl-accent-hot,#ff3d5a)] font-semibold animate-pulse uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--bl-accent-hot,#ff3d5a)]" />
                        Reading and indexing
                      </span>
                    )}
                    {item.status === 'done' && (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold uppercase">
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Done
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span
                        className="text-[var(--bl-accent-hot,#ff3d5a)] font-medium uppercase"
                        role="alert"
                      >
                        {item.error || 'Failed'}
                      </span>
                    )}
                  </div>

                  {item.warnings.length > 0 && (
                    <div className="w-full text-[11px] text-amber-400">
                      {item.warnings.map((w, idx) => (
                        <p key={idx}>⚠️ {w}</p>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {/* Uploaded Documents List */}
      <section className="max-w-4xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2.5 border-b border-[var(--border)]">
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-bold uppercase tracking-[0.18em] text-[var(--text)]">
              Uploaded documents ({documents.length}
              {limits ? ` of ${limits.max_files_per_workspace}` : ''})
            </h2>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono text-[var(--text-muted)] uppercase">
              <span>{totals.passages.toLocaleString()} passages indexed</span>
              {secondsUntilExpiry !== null && secondsUntilExpiry > 0 && (
                <>
                  <span aria-hidden="true" className="text-[var(--border)]">·</span>
                  <span>
                    Expires in {formatTimeRemaining(secondsUntilExpiry)} of inactivity
                  </span>
                </>
              )}
            </div>
          </div>

          {documents.length > 0 && (
            <div>
              {confirmDeleteAll ? (
                <div
                  className="flex items-center gap-2 p-2 rounded-sm bg-[#ff3d5a]/10 border border-[#ff3d5a]/30"
                  role="dialog"
                  aria-labelledby="confirm-delete-all-text"
                >
                  <span
                    id="confirm-delete-all-text"
                    className="text-xs font-mono font-bold uppercase text-[var(--bl-accent-hot,#ff3d5a)]"
                  >
                    Delete everything?
                  </span>
                  <button
                    ref={confirmDeleteRef}
                    type="button"
                    disabled={isUploading || isDeletingAll}
                    onClick={() => void handleConfirmDeleteEverything()}
                    className="px-2.5 py-1 rounded-sm text-xs font-mono font-bold uppercase bg-[var(--bl-accent-hot,#ff3d5a)] hover:bg-[#ff5c73] text-white cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400 disabled:opacity-40"
                  >
                    {isDeletingAll ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    type="button"
                    disabled={isUploading || isDeletingAll}
                    onClick={() => {
                      setConfirmDeleteAll(false);
                      deleteEverythingBtnRef.current?.focus();
                    }}
                    className="px-2.5 py-1 rounded-sm text-xs font-mono font-semibold uppercase bg-[var(--surface-raised)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface)] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  ref={deleteEverythingBtnRef}
                  type="button"
                  disabled={isUploading}
                  onClick={() => setConfirmDeleteAll(true)}
                  className="text-xs font-mono uppercase tracking-wider text-[var(--bl-accent-hot,#ff3d5a)] hover:bg-[#ff3d5a]/10 px-3 py-1.5 rounded-sm border border-[#ff3d5a]/40 bg-[#ff3d5a]/5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400 transition-colors"
                >
                  Delete everything
                </button>
              )}
            </div>
          )}
        </div>

        {removeError && (
          <p
            className="text-xs font-mono text-[var(--bl-accent-hot,#ff3d5a)] font-medium uppercase"
            role="alert"
          >
            {removeError}
          </p>
        )}

        {documents.length === 0 ? (
          <div className="p-8 rounded-sm bg-[var(--surface)] border border-[var(--border)] text-center text-xs sm:text-sm font-mono uppercase tracking-wider text-[var(--text-muted)]">
            {isLoadingSession
              ? 'Loading your workspace documents…'
              : 'No documents uploaded yet. Upload a PDF, TXT or Markdown file to begin.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-sm bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-accent)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md transition-colors"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePreviewDocument(doc)}
                      className="font-bold text-sm text-[var(--text)] hover:text-[var(--bl-accent-hot,#ff3d5a)] hover:underline truncate max-w-sm sm:max-w-md text-left cursor-pointer inline-flex items-center gap-1.5 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] rounded-sm"
                      title={`Preview ${doc.name}`}
                      aria-label={`Preview ${doc.name}`}
                    >
                      <span className="truncate">{doc.name}</span>
                      <svg
                        className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 text-[var(--bl-accent-hot,#ff3d5a)] shrink-0 transition-opacity"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <span className="uppercase text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-[#ff3d5a]/10 text-[var(--bl-accent-hot,#ff3d5a)] border border-[#ff3d5a]/30">
                      {doc.kind}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-[var(--text-muted)] uppercase">
                    {doc.pages !== null && (
                      <span>
                        {doc.pages} page{doc.pages > 1 ? 's' : ''}
                      </span>
                    )}
                    <span>
                      {doc.passage_count} passage{doc.passage_count > 1 ? 's' : ''}
                    </span>
                    <span>{doc.character_count.toLocaleString()} characters</span>
                  </div>

                  {doc.warnings.length > 0 && (
                    <div className="pt-1 text-xs text-amber-400 font-mono space-y-0.5" role="status">
                      {doc.warnings.map((w, idx) => (
                        <p key={idx}>⚠️ {w}</p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="self-end sm:self-center">
                  <button
                    type="button"
                    aria-label={`Remove ${doc.name}`}
                    disabled={isUploading || isRemovingDoc === doc.id}
                    onClick={() => void handleRemoveDocument(doc.id, doc.name)}
                    className="text-xs font-mono uppercase tracking-wider text-[var(--bl-accent-hot,#ff3d5a)] hover:underline px-2.5 py-1 rounded-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
                  >
                    {isRemovingDoc === doc.id ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Search Inside Documents */}
      <section className="max-w-4xl mx-auto space-y-6 pt-6 border-t border-[var(--border)]">
        <div className="text-center space-y-1.5">
          <h2 className="text-lg sm:text-xl font-extrabold uppercase tracking-[0.2em] text-[var(--text)]">
            Search inside your documents
          </h2>
          <p className="text-xs sm:text-sm uppercase tracking-wide text-[var(--text-muted)] font-mono">
            Ask questions or type keywords to retrieve relevant passages from your uploaded files.
          </p>
        </div>

        {documents.length === 0 ? (
          <div className="p-6 rounded-sm bg-[var(--surface)] border border-[var(--border)] text-center text-xs sm:text-sm font-mono uppercase text-[var(--text-muted)]">
            Upload at least one document first to search.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Search Box Form */}
            <form onSubmit={handleSearchSubmit} className="w-full max-w-2xl mx-auto">
              <label htmlFor="workspace-search-input" className="sr-only">
                Search your uploaded documents
              </label>
              <div className="relative flex items-center bg-[var(--surface)] border border-[var(--border)] focus-within:border-[var(--bl-accent-hot,#ff3d5a)] focus-within:shadow-[0_0_25px_rgba(255,61,90,0.25)] rounded-sm p-1.5 sm:p-2 transition-all">
                <div
                  className="pl-3 pr-2 font-mono font-bold text-sm text-[var(--bl-accent-hot,#ff3d5a)] pointer-events-none select-none"
                  aria-hidden="true"
                >
                  &gt;
                </div>
                <input
                  id="workspace-search-input"
                  name="workspace-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter a question or words to find in your files…"
                  maxLength={500}
                  className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-mono tracking-wide text-[var(--text)] placeholder-[var(--text-muted)] px-2 py-1.5 focus:outline-none uppercase"
                />
                <button
                  type="submit"
                  disabled={!searchQuery.trim() || isSearching || isUploading}
                  className="px-5 sm:px-6 py-2 rounded-sm text-xs font-bold uppercase tracking-[0.15em] bg-[var(--bl-accent-hot,#ff3d5a)] text-white shadow-sm hover:bg-[#ff5c73] disabled:opacity-40 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer select-none"
                >
                  {isSearching ? 'Searching…' : 'Search'}
                </button>
              </div>

              {searchQuery.length > 400 && (
                <p className="mt-1.5 text-xs font-mono text-[var(--bl-accent-hot,#ff3d5a)] text-center">
                  {searchQuery.length}/500 characters
                </p>
              )}
            </form>

            {/* Approach and Results Count Controls */}
            <div className="max-w-2xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-sm bg-[var(--surface)] border border-[var(--border)] text-xs font-mono uppercase">
              <div className="flex-1 space-y-1">
                <label
                  htmlFor="workspace-approach-select"
                  className="font-bold text-[var(--text)] block tracking-wider"
                >
                  Search approach:
                </label>
                <select
                  id="workspace-approach-select"
                  value={searchMethod}
                  onChange={(e) => setSearchMethod(e.target.value as WorkspaceSearchMethod)}
                  disabled={isSearching}
                  className="w-full bg-[var(--surface-raised)] text-[var(--text)] border border-[var(--border)] rounded-sm px-3 py-1.5 font-mono uppercase focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] cursor-pointer"
                >
                  {SEARCH_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {selectedMethodObj && (
                  <p className="text-[11px] text-[var(--text-muted)] pt-0.5 normal-case font-sans">
                    {selectedMethodObj.description}
                  </p>
                )}
              </div>

              <div className="sm:w-36 space-y-1">
                <label
                  htmlFor="workspace-k-select"
                  className="font-bold text-[var(--text)] block tracking-wider"
                >
                  Show:
                </label>
                <select
                  id="workspace-k-select"
                  value={searchK}
                  onChange={(e) => setSearchK(Number(e.target.value))}
                  disabled={isSearching}
                  className="w-full bg-[var(--surface-raised)] text-[var(--text)] border border-[var(--border)] rounded-sm px-3 py-1.5 font-mono uppercase focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] cursor-pointer"
                >
                  <option value={5}>5 results</option>
                  <option value={10}>10 results</option>
                  <option value={20}>20 results</option>
                </select>
              </div>
            </div>

            {/* Search Error */}
            {searchError && (
              <div
                className="max-w-2xl mx-auto p-4 rounded-sm bg-[#ff3d5a]/10 border border-[#ff3d5a]/30 text-xs sm:text-sm font-mono text-[var(--bl-accent-hot,#ff3d5a)] font-medium"
                role="alert"
              >
                {searchError}
              </div>
            )}

            {/* Search Results Display */}
            {searchResponse && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
                  <p>
                    Results for:{' '}
                    <span className="font-semibold text-[var(--text)]">
                      {searchSubmittedQuery}
                    </span>
                  </p>
                  <p className="font-mono text-[var(--bl-accent-hot,#ff3d5a)]">
                    {searchResponse.took_ms.toFixed(1)} ms
                  </p>
                </div>

                {searchResponse.results.length === 0 ? (
                  <div
                    className="p-6 rounded-sm bg-[var(--surface)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text-muted)] text-center leading-relaxed font-mono"
                    role="status"
                  >
                    {searchResponse.message ||
                      'No matching passages found. Try rephrasing your search or using different words.'}
                  </div>
                ) : (
                  <div className="rounded-sm border border-[var(--border)] bg-[var(--surface)] overflow-hidden divide-y divide-[var(--border-subtle)] shadow-xl">
                    {searchResponse.results.map((result) => (
                      <WorkspaceResultCard
                        key={`${result.document_id}-${result.passage_index}-${result.rank}`}
                        item={result}
                        query={searchSubmittedQuery}
                        isReranked={searchMethod === 'rerank'}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <FilePreviewModal
        isOpen={previewDoc !== null}
        onClose={() => setPreviewDoc(null)}
        docName={previewDoc?.name ?? ''}
        docKind={previewDoc?.kind ?? ''}
        file={previewDoc?.file ?? null}
        metadata={previewDoc?.metadata}
      />
    </div>
  );
}
