// Pure headroom & Soroban protocol limit helpers for ResourceLabel.

'use strict';

const { SOROBAN_LIMITS } = require('./nutritionLabel');

/**
 * Default per-transaction Soroban network limits.
 */
const SOROBAN_PROTOCOL_LIMITS = Object.freeze({
  cpuInstructions: SOROBAN_LIMITS.cpu_instructions, // 100M instructions
  ramBytes: SOROBAN_LIMITS.ram_bytes,               // 40 MB
  writeBytes: SOROBAN_LIMITS.ledger_write_bytes,    // 64 KB
  footprintKeys: 100,                               // 100 footprint keys
});

/**
 * Default ledger-wide Soroban network ceilings used to estimate how many
 * identical transactions can fit in a single ledger.
 */
const SOROBAN_LEDGER_LIMITS = Object.freeze({
  cpuInstructions: 250_000_000,
  ramBytes: 200 * 1024 * 1024,
  writeBytes: 132 * 1024,
  footprintKeys: 250,
});

const RESOURCE_METRIC_SPECS = Object.freeze([
  { key: 'cpuInstructions', label: 'CPU Load', unit: 'instr' },
  { key: 'ramBytes', label: 'RAM Alloc', unit: 'bytes' },
  { key: 'writeBytes', label: 'Ledger Writes', unit: 'bytes' },
  { key: 'footprintKeys', label: 'Ledger Size', unit: 'keys' },
]);

function toNonNegativeFinite(value) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}

/**
 * Determine threshold severity for a consumed percentage:
 * - safe: < 60% (green)
 * - warning: 60% - 85% (amber)
 * - critical: > 85% or exceeded (pulsing red)
 */
function getHeadroomSeverity(consumedPct) {
  if (consumedPct > 85) return 'critical';
  if (consumedPct >= 60) return 'warning';
  return 'safe';
}

/**
 * Compute per-metric consumed percentage, remaining headroom (`100 - used/limit*100`),
 * and single-ledger capacity against Soroban protocol limits.
 */
function computeResourceHeadroom(input = {}) {
  const txLimits = {
    ...SOROBAN_PROTOCOL_LIMITS,
    ...(input.limits || {}),
  };
  const ledgerLimits = {
    ...SOROBAN_LEDGER_LIMITS,
    ...(input.ledgerLimits || {}),
  };
  const rawUsage = input.usage || {};

  const pctFallback = {
    cpuInstructions: toNonNegativeFinite(input.cpuUsage),
    ramBytes: toNonNegativeFinite(input.ramUsage),
    writeBytes: toNonNegativeFinite(input.writeUsage),
    footprintKeys: toNonNegativeFinite(input.footprintUsage),
  };

  const metrics = RESOURCE_METRIC_SPECS.map((spec) => {
    const limit = toNonNegativeFinite(txLimits[spec.key]);
    const ledgerLimit = toNonNegativeFinite(ledgerLimits[spec.key]);
    const hasRaw = rawUsage[spec.key] !== undefined && rawUsage[spec.key] !== null;
    const used = hasRaw
      ? toNonNegativeFinite(rawUsage[spec.key])
      : (pctFallback[spec.key] / 100) * limit;

    const consumedPct = limit > 0 ? (used / limit) * 100 : 0;
    const headroomPct = 100 - consumedPct;
    const exceedsLimit = limit > 0 && used > limit;
    const severity = getHeadroomSeverity(consumedPct);

    let txPerLedger = null;
    if (used > 0 && ledgerLimit > 0) {
      txPerLedger = exceedsLimit ? 0 : Math.floor(ledgerLimit / used);
    }

    return {
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      used,
      limit,
      ledgerLimit,
      consumedPct,
      headroomPct,
      remainingHeadroomPct: Math.max(0, headroomPct),
      txPerLedger,
      exceedsLimit,
      severity,
    };
  });

  const finiteCapacities = metrics
    .map((m) => m.txPerLedger)
    .filter((n) => typeof n === 'number' && Number.isFinite(n));
  const bottleneckTxPerLedger =
    finiteCapacities.length > 0 ? Math.min(...finiteCapacities) : null;

  const hasCritical = metrics.some((m) => m.severity === 'critical');
  const hasWarning = !hasCritical && metrics.some((m) => m.severity === 'warning');
  const exceedsAnyLimit = metrics.some((m) => m.exceedsLimit);

  return {
    metrics,
    txLimits,
    ledgerLimits,
    bottleneckTxPerLedger,
    hasCritical,
    hasWarning,
    exceedsAnyLimit,
  };
}

module.exports = {
  SOROBAN_PROTOCOL_LIMITS,
  SOROBAN_LEDGER_LIMITS,
  RESOURCE_METRIC_SPECS,
  getHeadroomSeverity,
  computeResourceHeadroom,
};
