export type NameStatus = 'documented' | 'tentative';
export type Variant = 'plain' | 'rect' | 'badge';
export type QualityStatus = 'pass' | 'warning' | 'error';

export interface SvgFinding {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface InkTone {
  tone: 'dark' | 'light' | 'mixed';
  luminance: number;
  minLuminance: number;
  maxLuminance: number;
  samples: number;
}

export interface Asset {
  id: string;
  name: string;
  nameStatus: NameStatus;
  nameSource: string;
  aliases: string[];
  filename: string;
  relativePath: string;
  publicPath: string;
  collection: 'logos' | 'other';
  variant: Variant;
  format: 'svg';
  fileSize: number;
  sha256: string;
  viewBox: string | null;
  width: number | null;
  height: number | null;
  country: string | null;
  category: string | null;
  website: string | null;
  source: {
    upstream: string;
    collection: string;
    npmExport: string | null;
    npmExports: string[];
    npmPackage: string | null;
  };
  license: {
    code: string;
    scope: string;
    trademark: 'unknown' | string;
    note: string;
  };
  /** Estimated ink tone. Presentation hint only — never a claim about the brand. */
  ink?: InkTone;
  quality: {
    status: QualityStatus;
    findingCount: number;
    codes: string[];
    wellFormed: boolean;
    externalRefs: string[];
  };
}

export interface DatasetMeta {
  schemaVersion: number;
  name: string;
  description: string;
  generatedAt: string;
  generator: string;
  upstream: { repository: string; license: string; readme: string };
  npm: { package: string; version: string | null; mapped: number; note?: string };
  counts: {
    total: number;
    byFormat: Record<string, number>;
    byCollection: Record<string, number>;
    byVariant: Record<string, number>;
    documentedNames: number;
    totalBytes: number;
  };
  quality: {
    pass: number;
    warning: number;
    error: number;
    exactDuplicateGroups: number;
    visualDuplicateGroups: number;
    filenameConflicts: number;
  };
  unknowns: Record<string, string>;
}

export interface DuplicateGroup {
  sha256?: string;
  signature?: string;
  ids: string[];
}

export interface AuditReport {
  meta: DatasetMeta;
  issues: {
    id: string;
    name: string;
    file: string;
    kind: 'naming' | 'svg';
    findings: { code: string; message: string }[];
  }[];
  duplicates: { exact: DuplicateGroup[]; visual: DuplicateGroup[] };
  filenameConflicts: string[][];
}

export interface Dataset {
  meta: DatasetMeta;
  assets: Asset[];
  issues: AuditReport['issues'];
  duplicates: AuditReport['duplicates'];
  filenameConflicts: string[][];
}
