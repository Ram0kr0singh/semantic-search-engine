import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SearchItem } from '../../api';
import { CurveChart } from './CurveChart';
import { TopList } from './TopList';
import { ControlBar } from './ControlBar';
import { DetailPanel } from './DetailPanel';

const mockResults: SearchItem[] = [
  {
    rank: 1,
    score: 0.94,
    id: '2104.08653',
    title: 'Attention Is All You Need',
    snippet: 'Transformer architecture breakthrough.',
    categories: ['cs.CL', 'cs.AI'],
    year: 2017,
  },
  {
    rank: 2,
    score: 0.88,
    id: '1810.04805',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers',
    snippet: 'Language representation model.',
    categories: ['cs.CL'],
    year: 2018,
  },
  {
    rank: 3,
    score: 0.72,
    id: '2005.14165',
    title: 'Language Models are Few-Shot Learners',
    snippet: 'GPT-3 paper.',
    categories: ['cs.CL', 'cs.LG'],
    year: 2020,
  },
];

describe('Brand Love Score Components', () => {
  describe('TopList', () => {
    it('renders the numbered top 5 results list with uppercase styling', () => {
      const onSelect = vi.fn();
      const onHover = vi.fn();
      render(
        <TopList
          results={mockResults}
          activeRank={1}
          onHoverRank={onHover}
          onSelectResult={onSelect}
        />
      );

      expect(screen.getByText('TOP 5 RELEVANT PAPERS')).toBeInTheDocument();
      expect(screen.getByText(/1\.\s*Attention Is All You Need/i)).toBeInTheDocument();
      expect(screen.getByText(/2\.\s*BERT/i)).toBeInTheDocument();

      // Click to select
      fireEvent.click(screen.getByText(/1\.\s*Attention Is All You Need/i));
      expect(onSelect).toHaveBeenCalledWith(mockResults[0]);

      // Hover
      fireEvent.mouseEnter(screen.getByText(/2\.\s*BERT/i));
      expect(onHover).toHaveBeenCalledWith(2);
    });
  });

  describe('ControlBar', () => {
    it('toggles between curve view and list view and handles pagination', () => {
      const onToggle = vi.fn();
      const onPrev = vi.fn();
      const onNext = vi.fn();

      render(
        <ControlBar
          viewMode="curve"
          onToggleViewMode={onToggle}
          page={1}
          totalPages={3}
          onPrevPage={onPrev}
          onNextPage={onNext}
          hasResults={true}
        />
      );

      const listBtn = screen.getByTitle('List View');
      fireEvent.click(listBtn);
      expect(onToggle).toHaveBeenCalledWith('list');

      const nextBtn = screen.getByRole('button', { name: /next page of results/i });
      fireEvent.click(nextBtn);
      expect(onNext).toHaveBeenCalled();
    });
  });

  describe('DetailPanel', () => {
    it('slides out with full metadata and closes on Escape', () => {
      const onClose = vi.fn();
      render(
        <DetailPanel
          item={mockResults[0]}
          onClose={onClose}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Attention Is All You Need')).toBeInTheDocument();
      expect(screen.getByText(/arXiv ID: 2104.08653/i)).toBeInTheDocument();
      expect(screen.getByText('VIEW ON ARXIV.ORG')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('CurveChart', () => {
    it('renders the SVG curves, baseline, and floating tooltip flag', () => {
      const onSelect = vi.fn();
      const onHover = vi.fn();

      render(
        <CurveChart
          results={mockResults}
          activeRank={1}
          onHoverRank={onHover}
          onSelectResult={onSelect}
          isLoading={false}
          queryText="transformers"
        />
      );

      expect(screen.getByRole('region', { name: /semantic similarity bell curves/i })).toBeInTheDocument();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByText('Score: 0.940')).toBeInTheDocument();
      expect(screen.getByText(/Attention Is All You Need/i)).toBeInTheDocument();
    });
  });
});
