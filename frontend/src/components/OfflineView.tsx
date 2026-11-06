interface OfflineViewProps {
  onRetry: () => void;
}

export function OfflineView({ onRetry }: OfflineViewProps) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-50">
      <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
          !
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
          Semantic Search is offline
        </h1>

        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Unable to connect to the backend search API. Start the FastAPI server in another terminal from the repository root, then retry:
        </p>

        <div className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs sm:text-sm font-mono text-left overflow-x-auto select-all mb-6">
          <code>python -m uvicorn backend.app.api.main:app --port 8000</code>
        </div>

        <button
          type="button"
          onClick={onRetry}
          className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer"
        >
          Retry connection
        </button>
      </div>
    </main>
  );
}
