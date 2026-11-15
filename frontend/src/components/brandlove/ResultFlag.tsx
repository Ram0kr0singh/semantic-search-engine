interface ResultFlagProps {
  x: number;
  y: number;
  scoreText: string;
  title: string;
  visible: boolean;
  onClick?: () => void;
}

export function ResultFlag({
  x,
  y,
  scoreText,
  title,
  visible,
  onClick,
}: ResultFlagProps) {
  if (!visible) return null;

  return (
    <div
      role="tooltip"
      onClick={onClick}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-30px, -115%)',
        transition: 'left 280ms cubic-bezier(0.16, 1, 0.3, 1), top 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease',
      }}
      className="absolute z-20 pointer-events-auto cursor-pointer group flex items-center shadow-2xl select-none animate-in fade-in zoom-in-95 duration-200"
      title={`${title} (Score: ${scoreText}) — Click for details`}
    >
      {/* Red score block with left-pointing arrow tip */}
      <div className="relative flex items-center justify-center bg-[var(--bl-accent-hot,#ff3d5a)] text-white text-[11px] sm:text-xs font-black tracking-wider px-3 py-1.5 shadow-md">
        {/* Left triangle pointer tip */}
        <span
          className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[7px] border-y-transparent border-r-[8px] border-r-[var(--bl-accent-hot,#ff3d5a)]"
          aria-hidden="true"
        />
        <span>{scoreText}</span>
      </div>

      {/* Title block */}
      <div className="flex items-center bg-[var(--surface)] text-[var(--text)] text-[10px] sm:text-[11px] font-bold tracking-[0.18em] uppercase px-3.5 py-1.5 border border-l-0 border-[var(--border)] max-w-[220px] sm:max-w-[320px] truncate shadow-lg group-hover:bg-[var(--surface-raised)] transition-colors">
        <span className="truncate" title={title}>
          #{scoreText} · {title}
        </span>
      </div>

      {/* Downward connector pip to peak */}
      <span
        className="absolute left-[30px] -bottom-1.5 w-1 h-1.5 bg-[var(--bl-accent-hot,#ff3d5a)] shadow-xs"
        aria-hidden="true"
      />
    </div>
  );
}
