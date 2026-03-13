import { getFeatureModules } from "@/lib/api/settings";

const DOCUMENT_ANALYZER_ANONYMIZATION_FEATURE_KEY = "document_analyzer.anonymization";

export async function isDocumentAnalyzerAnonymizationEnabled(): Promise<boolean> {
  return getFeatureModules()
    .then((items) => {
      const module = items.find((item) => item.key === DOCUMENT_ANALYZER_ANONYMIZATION_FEATURE_KEY);
      return module?.effective_enabled ?? false;
    })
    .catch(() => false);
}
