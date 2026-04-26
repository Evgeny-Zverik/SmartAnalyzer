export const CREDIT_COSTS: Record<string, number> = {
  "document-analyzer": 180,
  "data-extractor": 160,
  "handwriting-recognition": 40,
  "legal-text-simplifier": 50,
  "spelling-checker": 30,
  "tender-analyzer": 120,
  "risk-analyzer": 120,
  "contract-checker": 120,
  "legal-style-translator": 60,
  "foreign-language-translator": 60,
  "legal-document-design-review": 140,
  key_points: 30,
  dates_deadlines: 30,
  risk_analyzer: 60,
  suggested_edits: 60,
};

export const DEFAULT_CREDIT_COST = 50;

export function getFallbackCreditCost(slug: string): number {
  return CREDIT_COSTS[slug] ?? DEFAULT_CREDIT_COST;
}
