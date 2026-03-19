import { apiFetch, ApiError } from "@/lib/api/client";
import { getToken } from "@/lib/auth/token";

const MOCK_DELAY_MS = 1500;
const configuredBaseURL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "http://localhost:8000";

function getBaseURL(): string {
  if (typeof window === "undefined") {
    return configuredBaseURL;
  }

  const currentHost = window.location.hostname;
  const isLocalHost = currentHost === "localhost" || currentHost === "127.0.0.1";

  try {
    const url = new URL(configuredBaseURL);
    const apiHost = url.hostname;
    const apiIsLocalHost = apiHost === "localhost" || apiHost === "127.0.0.1";

    if (!isLocalHost && apiIsLocalHost) {
      url.hostname = currentHost;
      return url.toString().replace(/\/$/, "");
    }

    return configuredBaseURL;
  } catch {
    return configuredBaseURL;
  }
}

export type DocumentAnalyzerRunResponse = {
  analysis_id: number;
  tool_slug: string;
  result: {
    summary: string;
    key_points: string[];
    risks: string[];
    important_dates: Array<{ date: string; description: string }>;
    advanced_editor: {
      full_text: string;
      rich_content?: Record<string, unknown> | null;
      source_format?: string | null;
      annotations: Array<{
        id: string;
        type: "risk" | "improvement";
        severity: "low" | "medium" | "high";
        start_offset: number;
        end_offset: number;
        exact_quote: string;
        title: string;
        reason: string;
        suggested_rewrite: string;
      }>;
    };
  };
};

export type DocumentAnalyzerPrepareResponse = {
  document_id: number;
  tool_slug: string;
  advanced_editor: {
    full_text: string;
    rich_content?: Record<string, unknown> | null;
    source_format?: string | null;
    annotations: Array<{
      id: string;
      type: "risk" | "improvement";
      severity: "low" | "medium" | "high";
      start_offset: number;
      end_offset: number;
      exact_quote: string;
      title: string;
      reason: string;
      suggested_rewrite: string;
    }>;
  };
};

export type ContractCheckerRunResponse = {
  analysis_id: number;
  tool_slug: string;
  result: {
    summary: string;
    risky_clauses: Array<{ title: string; reason: string; severity: string }>;
    penalties: Array<{ trigger: string; amount_or_formula: string }>;
    obligations: Array<{ party: string; text: string }>;
    deadlines: Array<{ date: string; description: string }>;
    checklist: Array<{ item: string; status: string; note: string }>;
  };
};

export type DataExtractorRunResponse = {
  analysis_id: number;
  tool_slug: string;
  result: {
    summary: string;
    left_document_summary: string;
    right_document_summary: string;
    common_points: string[];
    differences: string[];
    relation_assessment: string;
    are_documents_related: boolean;
  };
};

export type HandwritingRecognitionRunResponse = {
  analysis_id: number;
  tool_slug: string;
  result: {
    recognized_text: string;
    confidence: number;
    page_count: number;
    template_id?: string | null;
    ocr_model_id?: string | null;
    needs_review_count?: number;
    lines: Array<{
      text: string;
      confidence: number;
      model_id?: string | null;
      page_index?: number;
      field_name?: string | null;
      source?: string | null;
      needs_review?: boolean;
      bbox?: { x: number; y: number; width: number; height: number } | null;
    }>;
  };
};

export type TenderAnalyzerRunResponse = {
  analysis_id: number;
  tool_slug: string;
  result: {
    query: string;
    summary: string;
    search_scope: string;
    dispute_overview: string;
    regions: string[];
    court_positions: Array<{ court: string; position: string; relevance: string }>;
    cited_cases: Array<{ title: string; citation: string; url: string; takeaway: string }>;
    legal_basis: string[];
    practical_takeaways: string[];
    follow_up_prompt: string;
  };
};

export type TenderAnalyzerChatResponse = {
  tool_slug: string;
  result: TenderAnalyzerRunResponse["result"];
};

export type LLMConfigRequest = {
  base_url?: string;
  api_key?: string;
  model?: string;
  compression_level?: string;
  analysis_mode?: string;
};

export type EditedDocumentRequest = {
  full_text: string;
  rich_content?: Record<string, unknown> | null;
  source_format?: string | null;
};

export async function runDocumentAnalyzer(
  documentId: number,
  llmConfig?: LLMConfigRequest | null,
  signal?: AbortSignal,
  editedDocument?: EditedDocumentRequest | null
): Promise<DocumentAnalyzerRunResponse> {
  const body: {
    document_id: number;
    llm_config?: LLMConfigRequest;
    edited_document?: EditedDocumentRequest;
  } = { document_id: documentId };
  if (llmConfig && (llmConfig.base_url || llmConfig.api_key || llmConfig.model || llmConfig.compression_level)) {
    body.llm_config = llmConfig;
  }
  if (editedDocument?.full_text?.trim()) {
    body.edited_document = editedDocument;
  }
  return apiFetch<DocumentAnalyzerRunResponse>("/api/v1/tools/document-analyzer/run", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

export async function prepareDocumentAnalyzer(
  documentId: number,
  signal?: AbortSignal
): Promise<DocumentAnalyzerPrepareResponse> {
  return apiFetch<DocumentAnalyzerPrepareResponse>("/api/v1/tools/document-analyzer/prepare", {
    method: "POST",
    body: JSON.stringify({ document_id: documentId }),
    signal,
  });
}

export async function runContractChecker(documentId: number, signal?: AbortSignal): Promise<ContractCheckerRunResponse> {
  return apiFetch<ContractCheckerRunResponse>("/api/v1/tools/contract-checker/run", {
    method: "POST",
    body: JSON.stringify({ document_id: documentId }),
    signal,
  });
}

export async function runDataExtractor(
  documentId: number,
  compareDocumentId: number,
  llmConfig?: LLMConfigRequest | null,
  signal?: AbortSignal
): Promise<DataExtractorRunResponse> {
  const body: {
    document_id: number;
    compare_document_id: number;
    llm_config?: LLMConfigRequest;
  } = { document_id: documentId, compare_document_id: compareDocumentId };
  if (llmConfig && (llmConfig.base_url || llmConfig.api_key || llmConfig.model || llmConfig.compression_level)) {
    body.llm_config = llmConfig;
  }
  return apiFetch<DataExtractorRunResponse>("/api/v1/tools/data-extractor/run", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

export async function runHandwritingRecognition(
  documentId: number,
  signal?: AbortSignal
): Promise<HandwritingRecognitionRunResponse> {
  return apiFetch<HandwritingRecognitionRunResponse>("/api/v1/tools/handwriting-recognition/run", {
    method: "POST",
    body: JSON.stringify({ document_id: documentId }),
    signal,
  });
}

export async function runTenderAnalyzer(
  documentId: number,
  signal?: AbortSignal
): Promise<TenderAnalyzerRunResponse> {
  return apiFetch<TenderAnalyzerRunResponse>("/api/v1/tools/tender-analyzer/run", {
    method: "POST",
    body: JSON.stringify({ document_id: documentId }),
    signal,
  });
}

export async function runTenderAnalyzerChat(
  query: string,
  allowRelatedRegions = false,
  signal?: AbortSignal
): Promise<TenderAnalyzerChatResponse> {
  return apiFetch<TenderAnalyzerChatResponse>("/api/v1/tools/tender-analyzer/chat", {
    method: "POST",
    body: JSON.stringify({ query, allow_related_regions: allowRelatedRegions }),
    signal,
  });
}

const mockBySlug: Record<string, Record<string, unknown>> = {
  "contract-checker": {
    riskyClauses: ["П. 4.2 — неограниченная ответственность"],
    penalties: ["Штраф за просрочку 0.1% в день"],
    obligations: ["Поставка до 30 дней", "Оплата в течение 14 дней"],
    deadlines: ["Подписание до 01.03.2025"],
  },
  "data-extractor": {
    summary: "Документы описывают один и тот же предмет, но расходятся по срокам и распределению обязанностей.",
    left_document_summary: "Первый документ фиксирует базовые условия и общий предмет договоренности.",
    right_document_summary: "Второй документ описывает альтернативную редакцию с уточненными сроками и обязанностями.",
    common_points: ["Одинаковый предмет регулирования", "Схожая структура обязательств"],
    differences: ["Изменены сроки исполнения", "Перераспределена ответственность сторон"],
    relation_assessment: "Документы связаны и выглядят как разные версии одного договорного материала.",
    are_documents_related: true,
  },
  "tender-analyzer": {
    query: "практика по спорам Брянска",
    summary: "Подборка показывает подходы арбитражных судов к аналогичному спору и выделяет доказательства, которые влияют на исход дела.",
    search_scope: "Регион: Брянская область. Контур поиска: арбитражные суды.",
    dispute_overview: "Спор касается исполнения договорных обязательств, подтверждения объема работ и просрочки исполнения.",
    regions: ["Москва", "Санкт-Петербург"],
    court_positions: [
      {
        court: "Арбитражный суд города Москвы",
        position: "Суд оценивает не только договор, но и переписку, акты и платежные документы.",
        relevance: "Подходит для споров о фактическом исполнении обязательств.",
      },
    ],
    cited_cases: [
      {
        title: "Спор о взыскании оплаты по договору",
        citation: "А40-000001/2025",
        url: "https://kad.arbitr.ru/",
        takeaway: "Частичная оплата и акты могут подтвердить исполнение даже при споре о формулировках.",
      },
    ],
    legal_basis: ["Ст. 309 ГК РФ", "Ст. 431 ГК РФ", "Ст. 65 АПК РФ"],
    practical_takeaways: ["Соберите первичные документы и переписку.", "Покажите причинную связь между нарушением и убытками."],
    follow_up_prompt: "Уточните регион, период и инстанцию.",
  },
  "risk-analyzer": {
    riskScore: 42,
    keyDrivers: ["Внешние зависимости", "Сроки"],
    recommendations: ["Диверсифицировать поставщиков", "Заложить буфер по срокам"],
  },
};

export type AnalysisStage = "upload" | "analyze" | "review" | "done";

export type ProgressCallback = (stage: AnalysisStage, elapsedSec: number) => void;

export type ToolAnalysisResult = {
  result: Record<string, unknown>;
  documentId?: number;
};

export type DocumentAnalyzerStreamEvent =
  | {
      type: "progress";
      stage: "analyze" | "review";
      message: string;
      current: number;
      total: number;
    }
  | {
      type: "annotations_batch";
      annotations: DocumentAnalyzerRunResponse["result"]["advanced_editor"]["annotations"];
      current: number;
      total: number;
    }
  | {
      type: "final";
      analysis_id: number;
      tool_slug: string;
      result: DocumentAnalyzerRunResponse["result"];
    }
  | {
      type: "error";
      message: string;
    };

export async function streamDocumentAnalyzer(
  documentId: number,
  llmConfig: LLMConfigRequest | null | undefined,
  signal: AbortSignal | undefined,
  editedDocument: EditedDocumentRequest | null | undefined,
  onEvent: (event: DocumentAnalyzerStreamEvent) => void
): Promise<void> {
  const url = new URL(`${getBaseURL()}/api/v1/tools/document-analyzer/stream`);
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const body: {
    document_id: number;
    llm_config?: LLMConfigRequest;
    edited_document?: EditedDocumentRequest;
  } = { document_id: documentId };
  if (llmConfig && (llmConfig.base_url || llmConfig.api_key || llmConfig.model || llmConfig.compression_level)) {
    body.llm_config = llmConfig;
  }
  if (editedDocument?.full_text?.trim()) {
    body.edited_document = editedDocument;
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    try {
      const data = JSON.parse(text) as {
        error?: string;
        message?: string;
        detail?: string | unknown;
        details?: unknown;
      };
      const message =
        data.message ??
        (typeof data.detail === "string" ? data.detail : undefined) ??
        `API error ${response.status}`;
      throw new ApiError(response.status, data.error, message, data.details ?? data.detail);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new Error(text || `Request failed: ${response.status}`);
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming response body is not available.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const lines = chunk
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const dataLine = lines.find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      const raw = dataLine.slice(5).trim();
      if (!raw) continue;
      const event = JSON.parse(raw) as DocumentAnalyzerStreamEvent;
      onEvent(event);
    }
  }
}

export async function runToolAnalysis(
  toolSlug: string,
  file: File,
  llmConfig?: LLMConfigRequest | null,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
  options?: {
    existingDocumentId?: number | null;
    compareDocumentId?: number | null;
    editedDocument?: EditedDocumentRequest | null;
  }
): Promise<ToolAnalysisResult> {
  const startMs = Date.now();
  const elapsed = () => Math.round((Date.now() - startMs) / 1000);

  if (
    toolSlug === "document-analyzer" ||
    toolSlug === "contract-checker" ||
    toolSlug === "data-extractor" ||
    toolSlug === "handwriting-recognition" ||
    toolSlug === "tender-analyzer"
  ) {
    let documentId = options?.existingDocumentId ?? null;
    if (!documentId) {
      onProgress?.("upload", elapsed());
      const { uploadDocument } = await import("@/lib/api/documents");
      const uploadRes = await uploadDocument(file, { signal });
      documentId = uploadRes.document_id;
    }

    onProgress?.("analyze", elapsed());
    let result: Record<string, unknown>;
    if (toolSlug === "document-analyzer") {
      const runRes = await runDocumentAnalyzer(
        documentId,
        llmConfig,
        signal,
        options?.editedDocument
      );
      onProgress?.("review", elapsed());
      result = runRes.result as unknown as Record<string, unknown>;
    } else if (toolSlug === "contract-checker") {
      const runRes = await runContractChecker(documentId, signal);
      result = runRes.result as unknown as Record<string, unknown>;
    } else if (toolSlug === "data-extractor") {
      if (!options?.compareDocumentId) {
        throw new Error("Second document is required for comparison.");
      }
      const runRes = await runDataExtractor(documentId, options.compareDocumentId, llmConfig, signal);
      result = runRes.result as unknown as Record<string, unknown>;
    } else if (toolSlug === "tender-analyzer") {
      const runRes = await runTenderAnalyzer(documentId, signal);
      result = runRes.result as unknown as Record<string, unknown>;
    } else {
      const runRes = await runHandwritingRecognition(documentId, signal);
      result = runRes.result as unknown as Record<string, unknown>;
    }
    onProgress?.("done", elapsed());
    return { result, documentId };
  }
  onProgress?.("analyze", elapsed());
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));
  const data = mockBySlug[toolSlug];
  onProgress?.("done", elapsed());
  if (data) {
    return { result: data };
  }
  return { result: { message: "Mock result", toolSlug } };
}
