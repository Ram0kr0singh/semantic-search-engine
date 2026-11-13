interface OfflineViewProps {
  onRetry: () => void;
}

export function OfflineView({ onRetry }: OfflineViewProps) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--canvas)] relative overflow-hidden">
      {/* Decorative Glow */}
      <div
        className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] overflow-hidden -z-10"
        aria-hidden="true"
      >
        <div
          className="w-full h-full opacity-60"
          style={{
            background:
              'radial-gradient(circle at 50% 30%, var(--glow-1) 0%, transparent 65%)',
          }}
        />
      </div>

      <div className="max-w-lg w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl p-6 sm:p-8 text-center space-y-5">
        <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto text-xl font-bold shadow-xs">
          !
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text)] mb-2 tracking-tight">
            Semantic Search is offline
          </h1>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Unable to connect to the backend search API. Start the FastAPI server
            in another terminal from the repository root, then retry:
          </p>
        </div>

        <div className="bg-[var(--surface-toolbar)] border border-[var(--border-subtle)] text-blue-500 dark:text-blue-400 rounded-xl p-3 text-xs sm:text-sm font-mono text-left overflow-x-auto select-all shadow-inner">
          <code>python -m uvicorn backend.app.api.main:app --port 8000</code>
        </div>

        <div>
          <button
            type="button"
            onClick={onRetry}
            className="w-full sm:w-auto px-6 py-2.5 bg-[var(--hero-btn-bg)] text-[var(--hero-btn-fg)] hover:opacity-90 font-bold text-sm rounded-full shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer"
          >
            Retry connection
          </button>
        </div>
      </div>
    </main>
  );
}
