// IKeyResolver.ts — Interface for resolving API keys by model ID.

export interface IKeyResolver {
  getKey(modelId: string): Promise<string | null>;
}
