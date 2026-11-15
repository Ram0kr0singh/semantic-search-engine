import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import {
  escapeRegExp,
  formatFileSize,
  formatTimeRemaining,
  formatWorkspaceError,
  getQueryWords,
  highlightText,
  mapWorkspaceErrorCode,
} from './workspaceUtils';

describe('workspaceUtils', () => {
  describe('escapeRegExp', () => {
    it('escapes regex special characters properly', () => {
      const special = '.*+?^${}()|[]\\';
      const escaped = escapeRegExp(special);
      expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
      expect(() => new RegExp(escaped)).not.toThrow();
    });
  });

  describe('getQueryWords', () => {
    it('ignores words shorter than 3 characters and splits by whitespace', () => {
      expect(getQueryWords('')).toEqual([]);
      expect(getQueryWords('a to in on by')).toEqual([]);
      expect(getQueryWords('the quick brown fox')).toEqual(['the', 'quick', 'brown', 'fox']);
      expect(getQueryWords('  deep   learning  AI ')).toEqual(['deep', 'learning']);
    });
  });

  describe('highlightText', () => {
    it('splits text into React spans without using dangerouslySetInnerHTML', () => {
      const { container } = render(
        <div data-testid="output">{highlightText('Neural networks learn patterns', 'neural')}</div>
      );
      const output = container.querySelector('[data-testid="output"]')!;
      expect(output.innerHTML).not.toContain('dangerouslySetInnerHTML');
      const highlighted = output.querySelectorAll('span');
      expect(highlighted.length).toBeGreaterThan(0);
      expect(screen.getByText('Neural')).toHaveClass('bg-amber-300/35');
    });

    it('matches whole words case-insensitively and ignores < 3 chars', () => {
      render(<div>{highlightText('In an open world, open AI models learn.', 'in open')}</div>);
      // 'in' has 2 chars so it is ignored. 'open' has 4 chars so it is highlighted.
      const openMatches = screen.getAllByText('open');
      expect(openMatches.length).toBe(2);
      openMatches.forEach((match) => {
        expect(match).toHaveClass('bg-amber-300/35');
      });
      // 'In' must not be highlighted
      const inEl = screen.getByText(/In an/);
      expect(inEl).not.toHaveClass('bg-amber-300/35');
    });

    it('escapes regex characters and renders no HTML from a passage containing <img src=x onerror=alert(1)>', () => {
      const passage = 'Look at this payload: <img src=x onerror=alert(1)> and verify.';
      const query = 'alert(1) [a-z]*';
      const { container } = render(<div>{highlightText(passage, query)}</div>);

      // Verify that no <img> element exists in the DOM
      expect(container.querySelector('img')).toBeNull();
      // Text must be rendered safely as text
      expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    });
  });

  describe('mapWorkspaceErrorCode', () => {
    it('maps every backend error code to beginner-friendly plain language', () => {
      const expectedMappings: Record<string, string> = {
        upload_too_large: 'This file exceeds the upload size limit. Please choose a smaller file.',
        unsupported_upload: 'Only PDF, TXT, and Markdown (.md) files are accepted.',
        invalid_upload: 'This file does not appear to be a valid PDF.',
        invalid_pdf: 'The PDF could not be read. The file may be damaged or corrupted.',
        encrypted_pdf: 'This PDF is password-protected or encrypted. Please provide an unencrypted PDF.',
        pdf_page_limit: 'This PDF exceeds the maximum page limit.',
        document_too_large: 'The extracted text in this document exceeds the character limit.',
        no_extractable_text: 'No readable text was found in this PDF. Scanned images and OCR are not supported.',
        invalid_text: 'This text file is empty or not valid UTF-8 text.',
        no_passages: 'This document does not contain enough text to index and search.',
        file_limit: 'You have reached the maximum number of files for this workspace.',
        passage_limit: 'Adding this file would exceed the workspace passage limit.',
        indexing_failed: 'The document could not be indexed. Please try again.',
        workspace_capacity: 'The server is currently busy and at workspace capacity. Please try again later.',
        workspace_disabled: 'Document workspaces are currently disabled on this server.',
        workspace_not_found: 'Your workspace session has expired or was not found. Please start over by uploading a document.',
        document_not_found: 'The requested document was not found.',
        empty_workspace: 'Upload at least one document first.',
        method_unavailable: 'The selected search method is currently unavailable.',
        validation_error: 'Invalid request query or parameters.',
        unknown_method: 'Unknown search method.',
      };

      for (const [code, message] of Object.entries(expectedMappings)) {
        expect(mapWorkspaceErrorCode(code)).toBe(message);
      }
    });

    it('falls back to the API message for unknown codes without leaking objects', () => {
      expect(mapWorkspaceErrorCode('unrecognized_code', 'Custom API explanation')).toBe('Custom API explanation');
      expect(mapWorkspaceErrorCode('unrecognized_code', '[object Object]')).toBe('An unexpected error occurred. Please try again.');
      expect(mapWorkspaceErrorCode(undefined, undefined)).toBe('An unexpected error occurred. Please try again.');
    });

    it('formats ApiError instances with formatWorkspaceError', () => {
      const err = new ApiError(422, 'Custom raw message', 'pdf_page_limit');
      expect(formatWorkspaceError(err)).toBe('This PDF exceeds the maximum page limit.');

      const unknownErr = new ApiError(500, 'Internal server error occurred');
      expect(formatWorkspaceError(unknownErr)).toBe('Internal server error occurred');

      const nonApiError = new Error('Network failure');
      expect(formatWorkspaceError(nonApiError)).toBe('Network failure');

      expect(formatWorkspaceError(null)).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('formatTimeRemaining and formatFileSize', () => {
    it('formats seconds into human readable expiry hints', () => {
      expect(formatTimeRemaining(0)).toBe('Expired');
      expect(formatTimeRemaining(-10)).toBe('Expired');
      expect(formatTimeRemaining(45)).toBe('less than a minute');
      expect(formatTimeRemaining(120)).toBe('about 2 minutes');
      expect(formatTimeRemaining(3600)).toBe('about 1 hour');
      expect(formatTimeRemaining(7200)).toBe('about 2 hours');
    });

    it('formats byte numbers into human readable sizes', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(2048)).toBe('2.0 KB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });
  });
});
