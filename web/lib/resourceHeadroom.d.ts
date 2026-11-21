export interface SorobanResourceLimits {
  cpuInstructions: number;
  ramBytes: number;
  writeBytes: number;
  footprintKeys: number;
}

export type SorobanResourceMetricKey = keyof SorobanResourceLimits;

export type HeadroomSeverity = 'safe' | 'warning' | 'critical';

export interface ResourceHeadroomMetric {
  key: SorobanResourceMetricKey;
  label: string;
  unit: string;
  used: number;
  limit: number;
  ledgerLimit: number;
  consumedPct: number;
  headroomPct: number;
  remainingHeadroomPct: number;
  txPerLedger: number | null;
  exceedsLimit: boolean;
  severity: HeadroomSeverity;
}

export interface ResourceHeadroomInput {
  cpuUsage?: number;
  ramUsage?: number;
  footprintUsage?: number;
  writeUsage?: number;
  usage?: Partial<SorobanResourceLimits>;
  limits?: Partial<SorobanResourceLimits>;
  ledgerLimits?: Partial<SorobanResourceLimits>;
}

export interface ResourceHeadroomSummary {
  metrics: ResourceHeadroomMetric[];
  txLimits: Readonly<SorobanResourceLimits>;
  ledgerLimits: Readonly<SorobanResourceLimits>;
  bottleneckTxPerLedger: number | null;
  hasCritical: boolean;
  hasWarning: boolean;
  exceedsAnyLimit: boolean;
}

export const SOROBAN_PROTOCOL_LIMITS: Readonly<SorobanResourceLimits>;
export const SOROBAN_LEDGER_LIMITS: Readonly<SorobanResourceLimits>;

export function getHeadroomSeverity(consumedPct: number): HeadroomSeverity;
export function computeResourceHeadroom(
  input?: ResourceHeadroomInput,
): ResourceHeadroomSummary;
