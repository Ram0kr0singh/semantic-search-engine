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

      <div className="max-w-lg w-full bg-[var(--surface)] border border-[var(--border)] rounded-sm shadow-2xl p-6 sm:p-8 text-center space-y-5">
        <div className="w-10 h-10 rounded-full bg-[var(--bl-accent-hot,#ff3d5a)]/15 border border-[var(--bl-accent-hot,#ff3d5a)]/30 text-[var(--bl-accent-hot,#ff3d5a)] flex items-center justify-center mx-auto text-lg font-bold shadow-xs">
          !
        </div>

        <div>
          <h1 className="text-lg sm:text-xl font-extrabold uppercase tracking-[0.2em] text-[var(--text)] mb-2">
            Semantic Search is offline
          </h1>
          <p className="text-xs sm:text-sm font-mono uppercase tracking-wide text-[var(--text-muted)] leading-relaxed">
            Unable to connect to the backend search API. Start the FastAPI server
            in another terminal from the repository root, then retry:
          </p>
        </div>

        <div className="bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--bl-accent-hot,#ff3d5a)] rounded-sm p-3 text-xs font-mono text-left overflow-x-auto select-all">
          <code>python -m uvicorn backend.app.api.main:app --port 8000</code>
        </div>

        <div>
          <button
            type="button"
            onClick={onRetry}
            className="w-full sm:w-auto px-6 py-2.5 bg-[var(--bl-accent-hot,#ff3d5a)] text-white hover:bg-[#ff5c73] font-bold text-xs uppercase tracking-[0.15em] rounded-sm shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer"
          >
            Retry connection
          </button>
        </div>
      </div>
    </main>
  );
}
