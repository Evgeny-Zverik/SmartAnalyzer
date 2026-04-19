import { getFeatureModules, type FeatureModuleState } from "@/lib/api/settings";

const TOOL_FEATURE_KEYS: Record<string, string> = {
  "document-analyzer": "document_analyzer",
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

const FEATURE_MODULES_CACHE_KEY = "sa.feature-modules-cache-v1";

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

export function saveFeatureModulesCache(modules: FeatureModuleState[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FEATURE_MODULES_CACHE_KEY, JSON.stringify(modules));
  } catch {
    // ignore cache write errors
  }
}

function readFeatureModulesCache(): FeatureModuleState[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FEATURE_MODULES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeatureModuleState[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getEnabledToolSlugsFromModules(
  toolSlugs: string[],
  modules: FeatureModuleState[]
): Set<string> {
  return new Set(toolSlugs.filter((toolSlug) => isToolEnabled(toolSlug, modules)));
}

export async function getEnabledToolSlugs(toolSlugs: string[]): Promise<Set<string>> {
  try {
    const modules = await getFeatureModules();
    saveFeatureModulesCache(modules);
    return getEnabledToolSlugsFromModules(toolSlugs, modules);
  } catch (error) {
    const cachedModules = readFeatureModulesCache();
    if (cachedModules) {
      return getEnabledToolSlugsFromModules(toolSlugs, cachedModules);
    }
    throw error;
  }
}
