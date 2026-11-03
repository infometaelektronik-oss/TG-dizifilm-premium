/**
 * AI Gateway Provider (replaced with native Google Cloud Gemini helper)
 */
export function createLovableAiGatewayProvider(_apiKey?: string, _initialRunId?: string) {
  return (modelName: string) => ({
    modelId: modelName,
  });
}
