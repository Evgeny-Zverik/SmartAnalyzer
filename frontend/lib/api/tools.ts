const MOCK_DELAY_MS = 1500;

const mockBySlug: Record<string, Record<string, unknown>> = {
  "document-analyzer": {
    summary: "Краткое содержание документа (mock).",
    keyPoints: ["Пункт 1", "Пункт 2", "Пункт 3"],
    risks: ["Риск A", "Риск B"],
    dates: ["01.01.2025", "15.02.2025"],
  },
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
  _file: File
): Promise<Record<string, unknown>> {
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));
  const data = mockBySlug[toolSlug];
  if (data) {
    return data;
  }
  return { message: "Mock result", toolSlug };
}
