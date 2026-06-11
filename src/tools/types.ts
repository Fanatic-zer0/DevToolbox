export type ToolCategory = 'generators' | 'converters' | 'inspect' | 'formatters' | 'devops';

export interface DetectionInput {
  text: string;
  kind: 'text' | 'file';
  mimeType?: string;
  fileName?: string;
}

export interface DetectionSignal {
  confidence: number;
  reason: string;
}

export interface TransformResult {
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface OptionDef {
  id: string;
  label: string;
  type: 'select' | 'toggle' | 'number' | 'text';
  options?: { label: string; value: string }[];
  default: unknown;
}

export interface ToolDefinition<TOptions = Record<string, unknown>> {
  id: string;
  title: string;
  description: string;
  category: ToolCategory;
  keywords: string[];
  inputKind: 'text' | 'file' | 'image' | 'mixed';
  outputKind: 'text' | 'file' | 'image' | 'preview' | 'mixed';
  sensitive?: boolean;
  defaultOptions: TOptions;
  detect?: (input: DetectionInput) => DetectionSignal;
  load: () => Promise<{ default: React.ComponentType }>;
}

export interface DetectionResult {
  toolId: string;
  tool: ToolDefinition;
  confidence: number;
  reason: string;
}
