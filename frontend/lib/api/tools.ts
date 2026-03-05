import { apiFetch } from "@/lib/api/client";

const MOCK_DELAY_MS = 1500;

export type DocumentAnalyzerRunResponse = {
  analysis_id: number;
  tool_slug: string;
  result: {
    summary: string;
    key_points: string[];
    risks: string[];
    important_dates: Array<{ date: string; description: string }>;
  };
};

export type LLMConfigRequest = {
  base_url?: string;
  api_key?: string;
  model?: string;
};

export async function runDocumentAnalyzer(
  documentId: number,
  llmConfig?: LLMConfigRequest | null
): Promise<DocumentAnalyzerRunResponse> {
  const body: { document_id: number; llm_config?: LLMConfigRequest } = { document_id: documentId };
  if (llmConfig && (llmConfig.base_url || llmConfig.api_key || llmConfig.model)) {
    body.llm_config = llmConfig;
  }
  return apiFetch<DocumentAnalyzerRunResponse>("/api/v1/tools/document-analyzer/run", {
    method: "POST",
    body: JSON.stringify(body),
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
    structuredFields: { name: "Пример", value: "Значение" },
    tables: [{ col1: "A", col2: "B" }],
    jsonExport: true,
  },
  "tender-analyzer": {
    requirements: ["Требование 1", "Требование 2"],
    complianceChecklist: ["Критерий A — да", "Критерий B — да"],
    deadlines: ["Подача заявки до 10.03.2025"],
    risks: ["Риск несоответствия срокам"],
  },
  "risk-analyzer": {
    riskScore: 42,
    keyDrivers: ["Внешние зависимости", "Сроки"],
    recommendations: ["Диверсифицировать поставщиков", "Заложить буфер по срокам"],
  },
};

export async function runToolAnalysis(
  toolSlug: string,
  file: File,
  llmConfig?: LLMConfigRequest | null
): Promise<Record<string, unknown>> {
  if (toolSlug === "document-analyzer") {
    const { uploadDocument } = await import("@/lib/api/documents");
    const uploadRes = await uploadDocument(file);
    const runRes = await runDocumentAnalyzer(uploadRes.document_id, llmConfig);
    return runRes.result as unknown as Record<string, unknown>;
  }
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));
  const data = mockBySlug[toolSlug];
  if (data) {
    return data;
  }
  return { message: "Mock result", toolSlug };
}
