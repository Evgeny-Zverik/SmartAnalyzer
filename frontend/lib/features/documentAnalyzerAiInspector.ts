import { getFeatureModules } from "@/lib/api/settings";

const DOCUMENT_ANALYZER_AI_INSPECTOR_FEATURE_KEY = "document_analyzer.ai_inspector";

export async function isDocumentAnalyzerAiInspectorEnabled(): Promise<boolean> {
  return getFeatureModules()
    .then((items) => {
      const module = items.find((item) => item.key === DOCUMENT_ANALYZER_AI_INSPECTOR_FEATURE_KEY);
      return module?.effective_enabled ?? false;
    })
    .catch(() => false);
}
