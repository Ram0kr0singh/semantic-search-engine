import type { ReactNode } from 'react';
import { ApiError } from './api';

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getQueryWords(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 3);
}

export function highlightText(text: string, query: string): ReactNode[] {
  if (!text) return [];
  const words = getQueryWords(query);
  if (words.length === 0) {
    return [<span key="0">{text}</span>];
  }

  const uniqueWords = Array.from(new Set(words.map((w) => w.toLowerCase())));
  const escapedWords = uniqueWords.map(escapeRegExp);
  const regex = new RegExp(`(?<!\\w)(${escapedWords.join('|')})(?!\\w)`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;
    const isMatch = uniqueWords.includes(part.toLowerCase());
    if (isMatch) {
      return (
        <span
          key={index}
          className="bg-amber-300/35 dark:bg-amber-400/25 text-[var(--text)] font-semibold rounded-xs px-0.5"
        >
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function mapWorkspaceErrorCode(
  code?: string,
  defaultMessage?: string
): string {
  switch (code) {
    case 'upload_too_large':
      return 'This file exceeds the upload size limit. Please choose a smaller file.';
    case 'unsupported_upload':
      return 'Only PDF, TXT, and Markdown (.md) files are accepted.';
    case 'invalid_upload':
      return 'This file does not appear to be a valid PDF.';
    case 'invalid_pdf':
      return 'The PDF could not be read. The file may be damaged or corrupted.';
    case 'encrypted_pdf':
      return 'This PDF is password-protected or encrypted. Please provide an unencrypted PDF.';
    case 'pdf_page_limit':
      return 'This PDF exceeds the maximum page limit.';
    case 'document_too_large':
      return 'The extracted text in this document exceeds the character limit.';
    case 'no_extractable_text':
      return 'No readable text was found in this PDF. Scanned images and OCR are not supported.';
    case 'invalid_text':
      return 'This text file is empty or not valid UTF-8 text.';
    case 'no_passages':
      return 'This document does not contain enough text to index and search.';
    case 'file_limit':
      return 'You have reached the maximum number of files for this workspace.';
    case 'passage_limit':
      return 'Adding this file would exceed the workspace passage limit.';
    case 'indexing_failed':
      return 'The document could not be indexed. Please try again.';
    case 'workspace_capacity':
      return 'The server is currently busy and at workspace capacity. Please try again later.';
    case 'workspace_disabled':
      return 'Document workspaces are currently disabled on this server.';
    case 'workspace_not_found':
      return 'Your workspace session has expired or was not found. Please start over by uploading a document.';
    case 'document_not_found':
      return 'The requested document was not found.';
    case 'empty_workspace':
      return 'Upload at least one document first.';
    case 'method_unavailable':
      return 'The selected search method is currently unavailable.';
    case 'validation_error':
      return 'Invalid request query or parameters.';
    case 'unknown_method':
      return 'Unknown search method.';
    default:
      if (
        defaultMessage &&
        typeof defaultMessage === 'string' &&
        defaultMessage.trim() &&
        defaultMessage !== '[object Object]'
      ) {
        return defaultMessage;
      }
      return 'An unexpected error occurred. Please try again.';
  }
}

export function formatWorkspaceError(error: unknown): string {
  if (error instanceof ApiError) {
    return mapWorkspaceErrorCode(error.code, error.message);
  }
  if (error instanceof Error) {
    return mapWorkspaceErrorCode(undefined, error.message);
  }
  return 'An unexpected error occurred. Please try again.';
}

export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  const minutes = Math.ceil(seconds / 60);
  if (minutes > 60) {
    const hours = Math.round(minutes / 60);
    return `about ${hours} hour${hours > 1 ? 's' : ''}`;
  }
  if (minutes === 60) return 'about 1 hour';
  if (minutes > 1) return `about ${minutes} minutes`;
  return 'less than a minute';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
