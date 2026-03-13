import { getFeatureModules } from "@/lib/api/settings";

const DOCUMENT_ANALYZER_ENCRYPTION_FEATURE_KEY = "document_analyzer.encryption";

let encryptionEnabledPromise: Promise<boolean> | null = null;

export function clearDocumentAnalyzerEncryptionCache(): void {
  encryptionEnabledPromise = null;
}

export async function isDocumentAnalyzerEncryptionEnabled(): Promise<boolean> {
  if (!encryptionEnabledPromise) {
    encryptionEnabledPromise = getFeatureModules()
      .then((items) => {
        const module = items.find((item) => item.key === DOCUMENT_ANALYZER_ENCRYPTION_FEATURE_KEY);
        return module?.effective_enabled ?? false;
      })
      .catch(() => false);
  }
  return encryptionEnabledPromise;
}
