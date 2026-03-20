import { getFeatureModules, type FeatureModuleState } from "@/lib/api/settings";

const TOOL_FEATURE_KEYS: Record<string, string> = {
  "document-analyzer": "document_analyzer",
  "contract-checker": "contract_checker",
  "data-extractor": "data_extractor",
  "tender-analyzer": "tender_analyzer",
  "handwriting-recognition": "handwriting_recognition",
  "risk-analyzer": "risk_analyzer",
  "legal-style-translator": "legal_style_translator",
  "legal-text-simplifier": "legal_text_simplifier",
  "spelling-checker": "spelling_checker",
  "foreign-language-translator": "foreign_language_translator",
  "legal-document-design-review": "legal_document_design_review",
};

export function getFeatureKeyForTool(toolSlug: string): string | null {
  return TOOL_FEATURE_KEYS[toolSlug] ?? null;
}

export function isToolEnabled(toolSlug: string, modules: FeatureModuleState[]): boolean {
  const featureKey = getFeatureKeyForTool(toolSlug);
  if (!featureKey) {
    return true;
  }
  const feature = modules.find((item) => item.key === featureKey);
  return feature ? feature.effective_enabled : false;
}

export async function getEnabledToolSlugs(toolSlugs: string[]): Promise<Set<string>> {
  const modules = await getFeatureModules();
  return new Set(toolSlugs.filter((toolSlug) => isToolEnabled(toolSlug, modules)));
}
