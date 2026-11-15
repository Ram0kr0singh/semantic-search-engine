import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TypewriterHeading } from './TypewriterHeading';

describe('TypewriterHeading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders accessible label and screen-reader full text immediately', () => {
    const { container } = render(
      <TypewriterHeading
        lines={['Search papers by meaning,', 'not keywords']}
        accessibleTitle="Search papers by meaning, not keywords"
        animateInTest={false}
      />
    );

    const heading = screen.getByRole('heading', {
      name: 'Search papers by meaning, not keywords',
    });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveAttribute(
      'aria-label',
      'Search papers by meaning, not keywords'
    );
    expect(container.querySelectorAll('.typewriter-cursor')).toHaveLength(1);
  });

  it('types out lines sequentially with typewriter cursors when animated', () => {
    const { container } = render(
      <TypewriterHeading
        lines={['SEARCH YOUR OWN', 'DOCUMENTS']}
        accessibleTitle="Search your own documents"
        typingSpeed={40}
        startDelay={50}
        pauseBetweenLines={100}
        cursorColor="#ff3d5a"
        animateInTest={true}
      />
    );

    // Initial state before startDelay: 0 characters typed visually
    const heading = screen.getByRole('heading', {
      name: 'Search your own documents',
    });
    expect(heading).toBeInTheDocument();

    // Advance past startDelay and several characters of line 1
    act(() => {
      vi.advanceTimersByTime(50 + 40 * 6); // startDelay + 6 chars
    });

    expect(
      container.querySelector('[aria-hidden="true"]')?.textContent
    ).toContain('SEARCH');

    // Advance all remaining timers to complete both lines
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const visualContainer = container.querySelector('[aria-hidden="true"]');
    expect(visualContainer?.textContent).toContain('SEARCH YOUR OWN');
    expect(visualContainer?.textContent).toContain('DOCUMENTS');

    // Keep a single cursor after the animation completes.
    const cursors = container.querySelectorAll('.typewriter-cursor');
    expect(cursors).toHaveLength(1);
    expect(cursors[0]).toHaveStyle({ backgroundColor: 'rgb(255, 61, 90)' });
    expect(cursors[0].parentElement).toHaveTextContent('DOCUMENTS');
  });

  it('forwards headingRef and tabIndex correctly', () => {
    let capturedRef: HTMLHeadingElement | null = null;
    render(
      <TypewriterHeading
        headingRef={(el) => {
          capturedRef = el;
        }}
        tabIndex={-1}
        lines={['Search your own', 'documents']}
        accessibleTitle="Search your own documents"
        animateInTest={false}
      />
    );

    expect(capturedRef).not.toBeNull();
    expect(capturedRef).toHaveAttribute('tabindex', '-1');
    expect(capturedRef).toBeInstanceOf(HTMLHeadingElement);
  });
});
