import { getFeatureModules, getPublicFeatureModules } from "@/lib/api/settings";
import { getToken } from "@/lib/auth/token";

const DOCUMENT_ANALYZER_ENCRYPTION_FEATURE_KEY = "document_analyzer.encryption";

export function clearDocumentAnalyzerEncryptionCache(): void {
  // Kept as a no-op so callers do not need to change after removing stale caching.
}

export async function isDocumentAnalyzerEncryptionEnabled(): Promise<boolean> {
  const fetcher = getToken() ? getFeatureModules : getPublicFeatureModules;
  return fetcher()
    .then((items) => {
      const module = items.find(
        (item) => item.key === DOCUMENT_ANALYZER_ENCRYPTION_FEATURE_KEY,
      );
      return module?.effective_enabled ?? false;
    })
    .catch(() => false);
}
