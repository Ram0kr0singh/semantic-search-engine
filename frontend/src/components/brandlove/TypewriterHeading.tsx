import { useState, useEffect, useRef } from 'react';

export interface TypewriterHeadingProps {
  lines: string[];
  accessibleTitle?: string;
  className?: string;
  style?: React.CSSProperties;
  typingSpeed?: number;
  startDelay?: number;
  pauseBetweenLines?: number;
  cursorColor?: string;
  headingRef?: React.Ref<HTMLHeadingElement>;
  tabIndex?: number;
  as?: 'h1' | 'h2' | 'h3';
  animateInTest?: boolean;
}

export function TypewriterHeading({
  lines,
  accessibleTitle,
  className = '',
  style,
  typingSpeed = 50,
  startDelay = 120,
  pauseBetweenLines = 220,
  cursorColor = 'var(--bl-accent-hot, #ff3d5a)',
  headingRef,
  tabIndex,
  as: Component = 'h1',
  animateInTest = false,
}: TypewriterHeadingProps) {
  // Respect prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // In test environment, skip animation unless explicitly enabled via animateInTest
  const isTestEnv = import.meta.env?.MODE === 'test';
  const shouldAnimate = (!isTestEnv || animateInTest) && !prefersReducedMotion;

  const [charCounts, setCharCounts] = useState<number[]>(() =>
    shouldAnimate ? lines.map(() => 0) : lines.map((l) => l.length)
  );

  const [activeLineIndex, setActiveLineIndex] = useState<number>(0);
  const [isComplete, setIsComplete] = useState<boolean>(!shouldAnimate);
  const progressRef = useRef<{ line: number; char: number }>({ line: 0, char: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const linesKey = lines.join('\n');

  useEffect(() => {
    if (!shouldAnimate) {
      return;
    }

    progressRef.current = { line: 0, char: 0 };
    const currentLines = linesKey.split('\n');

    const typeNextChar = () => {
      const progress = progressRef.current;
      if (progress.line >= currentLines.length) {
        setIsComplete(true);
        return;
      }

      const lineText = currentLines[progress.line];
      if (progress.char < lineText.length) {
        progress.char += 1;
        const targetLine = progress.line;
        const targetChar = progress.char;
        setCharCounts((prev) => {
          const next = [...prev];
          next[targetLine] = targetChar;
          return next;
        });
        setActiveLineIndex(targetLine);
        // Subtle natural cadence variation (40ms - 65ms)
        const jitter = Math.floor(Math.random() * 20) - 10;
        timeoutRef.current = setTimeout(typeNextChar, Math.max(25, typingSpeed + jitter));
      } else {
        // Current line completed; advance to next line after short pause
        progress.line += 1;
        progress.char = 0;
        if (progress.line < currentLines.length) {
          setActiveLineIndex(progress.line);
          timeoutRef.current = setTimeout(typeNextChar, pauseBetweenLines);
        } else {
          setIsComplete(true);
        }
      }
    };

    timeoutRef.current = setTimeout(typeNextChar, startDelay);

    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [linesKey, typingSpeed, startDelay, pauseBetweenLines, shouldAnimate]);

  const fullText = accessibleTitle ?? lines.join(' ');
  const cursorLineIndex = isComplete ? lines.length - 1 : activeLineIndex;

  return (
    <Component
      ref={headingRef}
      tabIndex={tabIndex}
      aria-label={fullText}
      className={className}
      style={style}
    >
      {/* Screen-reader accessible full text */}
      <span className="sr-only">{fullText}</span>

      {/* Visual typewriter lines with blinking vertical cursors matching the reference */}
      <span aria-hidden="true" className="inline-block w-full">
        {lines.map((line, lineIdx) => {
          const count = charCounts[lineIdx] ?? 0;
          const visibleText = line.slice(0, count);
          const showCursor = lineIdx === cursorLineIndex;

          return (
            <span
              key={`${lineIdx}-${line}`}
              className="block leading-[1.1] min-h-[1.1em]"
            >
              <span>{visibleText}</span>
              {showCursor && (
                <span
                  className="typewriter-cursor inline-block w-[3px] sm:w-[4px] h-[0.82em] align-middle ml-1.5 sm:ml-2 rounded-xs select-none"
                  style={{
                    backgroundColor: cursorColor,
                    boxShadow: `0 0 10px ${cursorColor}`,
                  }}
                />
              )}
            </span>
          );
        })}
      </span>
    </Component>
  );
}
