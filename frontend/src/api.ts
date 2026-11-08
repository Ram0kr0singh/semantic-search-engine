import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';

export interface Method {
  id: string;
  display_name: string;
  model_name: string | null;
  ready: boolean;
  build_command?: string | null;
}

export interface Health {
  status: string;
  document_count: number;
  methods: Method[];
  embedding_device: string;
  api_version: string;
}

export interface SearchItem {
  rank: number;
  score: number;
  id: string;
  title: string;
  snippet: string;
  categories: string[];
  year: number | null;
}

export interface SearchResponse {
  query: string;
  method: string;
  k: number;
  took_ms: number;
  results: SearchItem[];
}

export interface DocumentRecord {
  id: string;
  title: string;
  abstract: string;
  categories: string[];
  year: number | null;
}

export interface SearchParams {
  query: string;
  method: string;
  k: number;
}
export interface EvaluationRun { method: string; dataset: string; model: string | null; generated_at: string; query_count: number; recall_at_1: number; recall_at_5: number; recall_at_10: number; recall_at_100: number; mrr_at_10: number; ndcg_at_10: number; index_build_seconds: number; average_query_latency_ms: number | null; fusion_only_latency_ms?: number | null; latency_note?: string | null; fusion?: { w_bm25?: number }; reranking?: { first_stage?: string; dense_model?: string | null }; }
export interface EvaluationResponse { runs: EvaluationRun[]; hardware_note: string; generated_at: string; }

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly buildCommand?: string;

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: unknown,
    buildCommand?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.buildCommand = buildCommand;
  }
}

export function formatValidationDetails(details: unknown): string {
  if (!Array.isArray(details)) return '';
  return details
    .map((detail) => detail && typeof detail === 'object' && typeof (detail as { msg?: unknown }).msg === 'string'
      ? (detail as { msg: string }).msg.replace(/^Value error,\s*/i, '') : '')
    .filter(Boolean)
    .join('; ');
}

let activeSearchController: AbortController | null = null;

export const beginSearch = (): AbortController => {
  if (activeSearchController) {
    activeSearchController.abort('cancelled');
  }
  activeSearchController = new AbortController();
  return activeSearchController;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  parentController?: AbortController
): Promise<T> {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort(parentController?.signal.reason);

  if (parentController) {
    if (parentController.signal.aborted) {
      controller.abort(parentController.signal.reason);
    } else {
      parentController.signal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  const timeoutId = window.setTimeout(() => {
    controller.abort('timeout');
  }, REQUEST_TIMEOUT_MS);

  try {
    const url = `${API_BASE_URL}${path}`;
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok) {
      const errorObj =
        body && typeof body === 'object' && 'error' in body
          ? (body.error as Record<string, unknown>)
          : null;

      const code = typeof errorObj?.code === 'string' ? errorObj.code : undefined;
      const details = errorObj?.details;
      const buildCommand =
        details && typeof details === 'object' && 'build_command' in details
          ? String((details as { build_command: unknown }).build_command)
          : undefined;

      let message = typeof errorObj?.message === 'string' ? errorObj.message : '';
      if (!message) {
        if (response.status === 404) message = 'Document not found.';
        else if (response.status === 422) message = 'Invalid request query or parameters.';
        else if (response.status === 503) message = 'Search method is currently unavailable.';
        else message = `Request failed with status ${response.status}.`;
      }

      if (buildCommand) {
        message = `${message} Build it with: ${buildCommand}`;
      }
      const validationDetails = response.status === 422 ? formatValidationDetails(details) : '';
      if (validationDetails) {
        message = `${message.replace(/[.:]$/, '')}: ${validationDetails}.`;
      }

      throw new ApiError(response.status, message, code, details, buildCommand);
    }

    return body as T;
  } catch (cause) {
    if (cause instanceof ApiError) {
      throw cause;
    }

    if (controller.signal.aborted) {
      if (controller.signal.reason === 'timeout') {
        throw new ApiError(
          0,
          `The request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds. Please try again.`,
          'timeout'
        );
      }
      throw new ApiError(0, 'The search request was cancelled.', 'cancelled');
    }

    throw new ApiError(
      0,
      `Unable to reach the API at ${API_BASE_URL}. Verify that the backend server is running.`,
      'network_error'
    );
  } finally {
    window.clearTimeout(timeoutId);
    if (parentController) {
      parentController.signal.removeEventListener('abort', onParentAbort);
    }
  }
}

export const api = {
  health: () => request<Health>('/health'),
  methods: () => request<Method[]>('/methods'),
  evaluation: () => request<EvaluationResponse>('/evaluation'),
  document: (id: string) => request<DocumentRecord>(`/documents/${encodeURIComponent(id)}`),
  search: (params: SearchParams, controller?: AbortController) =>
    request<SearchResponse>(
      '/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      },
      controller
    ),
  beginSearch,
};
