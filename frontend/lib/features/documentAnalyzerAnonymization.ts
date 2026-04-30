import { getFeatureModules, getPublicFeatureModules } from "@/lib/api/settings";
import { getToken } from "@/lib/auth/token";

const DOCUMENT_ANALYZER_ANONYMIZATION_FEATURE_KEY =
  "document_analyzer.anonymization";

export async function isDocumentAnalyzerAnonymizationEnabled(): Promise<boolean> {
  const fetcher = getToken() ? getFeatureModules : getPublicFeatureModules;
  return fetcher()
    .then((items) => {
      const module = items.find(
        (item) => item.key === DOCUMENT_ANALYZER_ANONYMIZATION_FEATURE_KEY,
      );
      return module?.effective_enabled ?? false;
    })
    .catch(() => false);
}
