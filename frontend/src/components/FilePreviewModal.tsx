import { useEffect, useState } from 'react';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  docName: string;
  docKind: string;
  file: File | null;
  metadata?: {
    pages?: number | null;
    passages?: number;
    characters?: number;
  };
}

export function FilePreviewModal({
  isOpen,
  onClose,
  docName,
  docKind,
  file,
  metadata,
}: FilePreviewModalProps) {
  if (!isOpen) return null;

  return (
    <FilePreviewModalContent
      onClose={onClose}
      docName={docName}
      docKind={docKind}
      file={file}
      metadata={metadata}
    />
  );
}

function FilePreviewModalContent({
  onClose,
  docName,
  docKind,
  file,
  metadata,
}: {
  onClose: () => void;
  docName: string;
  docKind: string;
  file: File | null;
  metadata?: {
    pages?: number | null;
    passages?: number;
    characters?: number;
  };
}) {
  const [isMaximized, setIsMaximized] = useState(false);
  const isPdf = !!file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

  // Create object URL synchronously if PDF
  const [objectUrl] = useState<string | null>(() => {
    if (file && isPdf && typeof URL !== 'undefined' && URL.createObjectURL) {
      try {
        return URL.createObjectURL(file);
      } catch {
        return null;
      }
    }
    return null;
  });

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (objectUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => !!file && !isPdf);

  useEffect(() => {
    if (!file || isPdf) return;

    let ignore = false;
    file
      .text()
      .then((text) => {
        if (!ignore) {
          setTextContent(text);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setTextContent('Failed to read text content from file.');
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [file, isPdf]);

  // Handle ESC key to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className={
        isMaximized
          ? 'fixed inset-0 z-50 flex flex-col bg-black/95 animate-in fade-in duration-150'
          : 'fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200'
      }
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${docName}`}
      onClick={(e) => {
        if (!isMaximized && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={
          isMaximized
            ? 'relative w-full h-full flex flex-col bg-[var(--surface)] overflow-hidden'
            : 'relative w-full max-w-6xl xl:max-w-7xl h-[92vh] sm:h-[95vh] flex flex-col rounded-sm bg-[var(--surface)] border border-[var(--border)] shadow-2xl overflow-hidden'
        }
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[var(--border)] bg-[var(--surface-toolbar)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <span className="w-2 h-2 rounded-full bg-[var(--bl-accent-hot,#ff3d5a)] shadow-[0_0_8px_rgba(255,61,90,0.8)] shrink-0" aria-hidden="true" />
            <h2 className="font-bold text-sm sm:text-base text-[var(--text)] truncate font-sans tracking-wide">
              {docName}
            </h2>
            <span className="uppercase text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-[#ff3d5a]/10 text-[var(--bl-accent-hot,#ff3d5a)] border border-[#ff3d5a]/30 shrink-0">
              {docKind}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {objectUrl && (
              <a
                href={objectUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in new tab"
                title="Open in new tab"
                className="w-8 h-8 rounded-sm flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-raised)] border border-transparent hover:border-[var(--border)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            )}

            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              aria-label={isMaximized ? 'Restore size' : 'Fill screen'}
              title={isMaximized ? 'Restore size' : 'Fill screen'}
              className="w-8 h-8 rounded-sm flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-raised)] border border-transparent hover:border-[var(--border)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] cursor-pointer"
            >
              {isMaximized ? (
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="w-8 h-8 rounded-sm flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--bl-accent-hot,#ff3d5a)] hover:bg-[#ff3d5a]/10 border border-transparent hover:border-[#ff3d5a]/20 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Body - fills remaining space completely */}
        <div className="relative flex-1 w-full min-h-0 bg-[var(--surface-raised)] p-1 sm:p-2 overflow-hidden flex flex-col">
          {file ? (
            objectUrl ? (
              <div className="relative w-full h-full flex-1 min-h-[500px] overflow-hidden bg-white">
                <iframe
                  src={`${objectUrl}#view=FitH`}
                  title={`Preview of ${docName}`}
                  className="w-full h-full min-h-[500px] border-0 block"
                  style={{ width: '100%', height: '100%', minHeight: '100%', border: 'none' }}
                />
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full text-xs font-mono text-[var(--text-muted)] animate-pulse">
                Loading text preview…
              </div>
            ) : (
              <div className="relative w-full h-full flex-1 min-h-[500px] overflow-hidden bg-[var(--surface)] border border-[var(--border)]">
                <pre className="absolute inset-0 w-full h-full overflow-auto p-4 sm:p-6 text-xs sm:text-sm font-mono whitespace-pre-wrap leading-relaxed text-[var(--text)]">
                  {textContent}
                </pre>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-3">
              <span className="w-3 h-3 rounded-full bg-[var(--bl-accent-hot,#ff3d5a)] shadow-[0_0_10px_rgba(255,61,90,0.8)]" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-[var(--text)] font-sans tracking-wide">
                  {docName}
                </p>
                <p className="text-xs font-mono text-[var(--text-muted)]">
                  {metadata?.pages ? `${metadata.pages} pages · ` : ''}
                  {metadata?.passages ? `${metadata.passages} passages · ` : ''}
                  {metadata?.characters ? `${metadata.characters.toLocaleString()} characters` : ''}
                </p>
              </div>
              <p className="max-w-md text-xs text-[var(--text-muted)] leading-relaxed">
                Full file preview is available for files uploaded during the active browser session. The server keeps documents in temporary memory without persisting raw files to disk.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-2.5 border-t border-[var(--border)] bg-[var(--surface-toolbar)] flex items-center justify-between text-xs text-[var(--text-muted)] shrink-0 font-mono">
          <div className="flex items-center gap-3">
            <span>
              Press{' '}
              <kbd className="px-1.5 py-0.5 rounded-sm bg-[var(--surface-raised)] border border-[var(--border)] font-mono text-[10px] text-[var(--text)]">
                Esc
              </kbd>{' '}
              to close
            </span>
            {metadata && metadata.passages !== undefined && (
              <span className="hidden sm:inline-block text-[var(--text-muted)]">
                · {metadata.pages ? `${metadata.pages} page${metadata.pages > 1 ? 's' : ''} · ` : ''}
                {metadata.passages} passage{metadata.passages > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-sm font-semibold uppercase tracking-wider bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface)] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] transition-colors text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
