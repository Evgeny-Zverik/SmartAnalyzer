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
    fields: Array<{ key: string; value: string }>;
    tables: Array<{ name: string; rows: string[][] }>;
    confidence: number;
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

export async function runContractChecker(documentId: number): Promise<ContractCheckerRunResponse> {
  return apiFetch<ContractCheckerRunResponse>("/api/v1/tools/contract-checker/run", {
    method: "POST",
    body: JSON.stringify({ document_id: documentId }),
  });
}

export async function runDataExtractor(documentId: number): Promise<DataExtractorRunResponse> {
  return apiFetch<DataExtractorRunResponse>("/api/v1/tools/data-extractor/run", {
    method: "POST",
    body: JSON.stringify({ document_id: documentId }),
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

export type AnalysisStage = "upload" | "analyze" | "done";

export type ProgressCallback = (stage: AnalysisStage, elapsedSec: number) => void;

export async function runToolAnalysis(
  toolSlug: string,
  file: File,
  llmConfig?: LLMConfigRequest | null,
  onProgress?: ProgressCallback
): Promise<Record<string, unknown>> {
  const startMs = Date.now();
  const elapsed = () => Math.round((Date.now() - startMs) / 1000);

  if (toolSlug === "document-analyzer" || toolSlug === "contract-checker" || toolSlug === "data-extractor") {
    onProgress?.("upload", elapsed());
    const { uploadDocument } = await import("@/lib/api/documents");
    const uploadRes = await uploadDocument(file);

    onProgress?.("analyze", elapsed());
    let result: Record<string, unknown>;
    if (toolSlug === "document-analyzer") {
      const runRes = await runDocumentAnalyzer(uploadRes.document_id, llmConfig);
      result = runRes.result as unknown as Record<string, unknown>;
    } else if (toolSlug === "contract-checker") {
      const runRes = await runContractChecker(uploadRes.document_id);
      result = runRes.result as unknown as Record<string, unknown>;
    } else {
      const runRes = await runDataExtractor(uploadRes.document_id);
      result = runRes.result as unknown as Record<string, unknown>;
    }
    onProgress?.("done", elapsed());
    return result;
  }
  onProgress?.("analyze", elapsed());
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));
  const data = mockBySlug[toolSlug];
  onProgress?.("done", elapsed());
  if (data) {
    return data;
  }
  return { message: "Mock result", toolSlug };
}
