export type Severity = 'error' | 'warning' | 'info';

export interface SvgFinding {
  code: string;
  severity: Severity;
  message: string;
}

export interface ViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
  raw: string;
}

export interface InkTone {
  tone: 'dark' | 'light' | 'mixed';
  luminance: number;
  minLuminance: number;
  maxLuminance: number;
  samples: number;
}

export interface SvgAnalysis {
  file: string;
  bytes: number;
  format: 'svg';
  status: 'pass' | 'warning' | 'error';
  counts: Record<Severity, number>;
  findings: SvgFinding[];
  viewBox?: ViewBox | null;
  width?: number | null;
  height?: number | null;
  declaredWidth?: string | null;
  declaredHeight?: string | null;
  elements?: Record<string, number>;
  externalRefs?: string[];
  wellFormed?: boolean;
  ink?: InkTone;
}

export declare const SEVERITIES: Severity[];

export declare function checkWellFormed(source: string): { ok: boolean; error?: string; openTags: string[] };

export declare function parseAttributes(attrs: string): Record<string, string>;

export declare function parseViewBox(value: string | undefined): ViewBox | null;

export declare function analyzeSvg(
  fileName: string,
  source: string,
  options?: { maxBytes?: number },
): SvgAnalysis;

/** Estimated ink tone, used only to choose a preview plate that keeps the mark visible. */
export declare function analyzeInkTone(source: string): InkTone;

export declare function collectExternalRefs(source: string): string[];

export declare function formatBytes(bytes: number): string;
