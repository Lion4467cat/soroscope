import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Cpu, Database, HardDrive, FileOutput, AlertTriangle, Zap } from "lucide-react";
import { cn } from "../lib/utils";
import {
  SOROBAN_PROTOCOL_LIMITS,
  SOROBAN_LEDGER_LIMITS,
  computeResourceHeadroom,
  type HeadroomSeverity,
  type SorobanResourceLimits,
  type SorobanResourceMetricKey,
} from "../lib/resourceHeadroom";

export {
  SOROBAN_PROTOCOL_LIMITS,
  SOROBAN_LEDGER_LIMITS,
  computeResourceHeadroom,
};

interface ResourceMetricProps {
  label: string;
  consumedPct: number;
  headroomPct: number;
  used: number;
  limit: number;
  unit: string;
  txPerLedger: number | null;
  exceedsLimit: boolean;
  severity: HeadroomSeverity;
  icon: React.ElementType;
}

const getStatusColor = (severity: HeadroomSeverity) => {
  if (severity === "critical")
    return "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)] animate-pulse"; // Critical (>85% or exceeded)
  if (severity === "warning")
    return "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]"; // Warning (60-85%)
  return "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"; // Safe (<60%)
};

const getTextColor = (severity: HeadroomSeverity) => {
  if (severity === "critical")
    return "text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]";
  if (severity === "warning")
    return "text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]";
  return "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]";
};

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatQuantity(value: number, unit: string): string {
  if (unit === "bytes") {
    if (value >= 1024 * 1024) return `${formatPercent(value / (1024 * 1024))} MB`;
    if (value >= 1024) return `${formatPercent(value / 1024)} KB`;
    return `${Math.round(value)} B`;
  }
  if (unit === "instr") {
    if (value >= 1_000_000) return `${formatPercent(value / 1_000_000)}M`;
    if (value >= 1_000) return `${formatPercent(value / 1_000)}K`;
    return `${Math.round(value)}`;
  }
  return `${Math.round(value)} keys`;
}

const METRIC_ICONS: Record<SorobanResourceMetricKey, React.ElementType> = {
  cpuInstructions: Cpu,
  ramBytes: HardDrive,
  writeBytes: FileOutput,
  footprintKeys: Database,
};

const ResourceMetric = ({
  label,
  consumedPct,
  headroomPct,
  used,
  limit,
  unit,
  txPerLedger,
  exceedsLimit,
  severity,
  icon: Icon,
}: ResourceMetricProps) => {
  const statusColor = getStatusColor(severity);
  const textColor = getTextColor(severity);
  const clampedWidth = Math.max(0, Math.min(consumedPct, 100));

  return (
    <div className="flex flex-col gap-2.5 relative group/metric">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-slate-800/80 border border-slate-700/50 shadow-inner">
            <Icon className="h-3.5 w-3.5 text-slate-400 group-hover/metric:text-slate-200 transition-colors" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 group-hover/metric:text-slate-300 transition-colors">
            {label}
          </span>
        </div>
        <div className="flex items-baseline gap-2 font-mono">
          <span className={cn("text-base font-bold tracking-tight", textColor)}>
            {formatPercent(consumedPct)}%
          </span>
          <span className="text-[11px] text-slate-400">
            {exceedsLimit
              ? `-${formatPercent(Math.abs(headroomPct))}% over`
              : `${formatPercent(headroomPct)}% headroom`}
          </span>
        </div>
      </div>

      {/* Progress Bar Container with "Groove" effect */}
      <div className="h-2.5 w-full overflow-hidden rounded-sm bg-slate-950/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)] border-b border-white/5">
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out relative",
            statusColor,
          )}
          style={{ width: `${clampedWidth}%` }}
        >
          {/* Scanline effect on bar */}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)]" />
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
        <span>
          {formatQuantity(used, unit)} / {formatQuantity(limit, unit)} tx limit
        </span>
        <span>
          {txPerLedger === null
            ? "Ledger cap: ready"
            : exceedsLimit
              ? "0 tx/ledger"
              : `${txPerLedger} tx/ledger`}
        </span>
      </div>
    </div>
  );
};

interface ResourceLabelProps {
  cpuUsage?: number;
  ramUsage?: number;
  footprintUsage?: number;
  writeUsage?: number;
  usage?: Partial<SorobanResourceLimits>;
  limits?: Partial<SorobanResourceLimits>;
  ledgerLimits?: Partial<SorobanResourceLimits>;
}

export function ResourceLabel({
  cpuUsage = 0,
  ramUsage = 0,
  footprintUsage = 0,
  writeUsage = 0,
  usage,
  limits,
  ledgerLimits,
}: ResourceLabelProps) {
  const summary = computeResourceHeadroom({
    cpuUsage,
    ramUsage,
    footprintUsage,
    writeUsage,
    usage,
    limits,
    ledgerLimits,
  });

  return (
    <Card className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden group">
      {/* Tempered Glass Physical Attributes */}

      {/* 1. Noise Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      {/* 2. Inner Ring for Bevel effect */}
      <div className="absolute inset-[1px] rounded-lg border border-white/5 pointer-events-none" />

      {/* 3. Top Specular Highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />

      {/* 4. Technical Corner Accents ("Bolts") */}
      <div className="absolute top-3 left-3 w-1.5 h-1.5 rounded-full bg-slate-700/50 shadow-[inset_0_0_2px_rgba(0,0,0,0.8)] border border-slate-600/30" />
      <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-slate-700/50 shadow-[inset_0_0_2px_rgba(0,0,0,0.8)] border border-slate-600/30" />
      <div className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-slate-700/50 shadow-[inset_0_0_2px_rgba(0,0,0,0.8)] border border-slate-600/30" />
      <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-slate-700/50 shadow-[inset_0_0_2px_rgba(0,0,0,0.8)] border border-slate-600/30" />

      <CardHeader className="pb-6 pt-7 relative z-10">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 shadow-inner border border-white/5">
              <Zap className="h-4 w-4 text-cyan-400" />
            </div>
            <span className="bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent drop-shadow-sm">
              SYSTEM STATUS
            </span>
          </CardTitle>
          {summary.exceedsAnyLimit ? (
            <div
              role="alert"
              className="flex items-center gap-1.5 rounded bg-rose-500/20 px-3 py-1 text-[10px] font-bold tracking-widest text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.25)] animate-pulse uppercase"
            >
              <AlertTriangle className="h-3 w-3 mb-0.5" />
              Exceeds Network Limit
            </div>
          ) : summary.hasCritical ? (
            <div className="flex items-center gap-1.5 rounded bg-rose-500/10 px-3 py-1 text-[10px] font-bold tracking-widest text-rose-400 border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)] animate-pulse uppercase">
              <AlertTriangle className="h-3 w-3 mb-0.5" />
              Critical
            </div>
          ) : summary.hasWarning ? (
            <div className="flex items-center gap-1.5 rounded bg-amber-500/10 px-3 py-1 text-[10px] font-bold tracking-widest text-amber-400 border border-amber-500/20 uppercase">
              <AlertTriangle className="h-3 w-3 mb-0.5" />
              Warning
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest text-emerald-500/80 uppercase">
                Active
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 relative z-10">
        {summary.metrics.map((metric) => (
          <ResourceMetric
            key={metric.key}
            label={metric.label}
            consumedPct={metric.consumedPct}
            headroomPct={metric.headroomPct}
            used={metric.used}
            limit={metric.limit}
            unit={metric.unit}
            txPerLedger={metric.txPerLedger}
            exceedsLimit={metric.exceedsLimit}
            severity={metric.severity}
            icon={METRIC_ICONS[metric.key]}
          />
        ))}

        {/* Footer Technical Detail */}
        <div className="mt-2 flex justify-between items-center border-t border-white/5 pt-4">
          <span className="text-[10px] font-mono text-slate-400">
            {summary.bottleneckTxPerLedger === null
              ? "LEDGER CAPACITY: READY"
              : `CAPACITY: ${summary.bottleneckTxPerLedger} TX/LEDGER`}
          </span>
          <span className="text-[10px] font-mono text-slate-600">
            SOROBAN PROTOCOL LIMITS
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
