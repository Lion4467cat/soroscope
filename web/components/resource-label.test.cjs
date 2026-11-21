// resource-label.test.cjs — unit tests for Soroban protocol headroom gauges
// Issue #1454
// Runs with: node --test ./components/resource-label.test.cjs

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SOROBAN_PROTOCOL_LIMITS,
  SOROBAN_LEDGER_LIMITS,
  getHeadroomSeverity,
  computeResourceHeadroom,
} = require('../lib/resourceHeadroom');

const COMPONENT_SOURCE = fs.readFileSync(
  path.join(__dirname, 'resource-label.tsx'),
  'utf8',
);

test('SOROBAN_PROTOCOL_LIMITS exposes exact Soroban network ceilings', () => {
  assert.equal(SOROBAN_PROTOCOL_LIMITS.cpuInstructions, 100_000_000);
  assert.equal(SOROBAN_PROTOCOL_LIMITS.ramBytes, 40 * 1024 * 1024);
  assert.equal(SOROBAN_PROTOCOL_LIMITS.writeBytes, 64 * 1024);
  assert.equal(SOROBAN_PROTOCOL_LIMITS.footprintKeys, 100);
});

test('computeResourceHeadroom computes headroom_pct = 100 - (used / limit * 100)', () => {
  const summary = computeResourceHeadroom({
    usage: {
      cpuInstructions: 25_000_000,    // 25% consumed -> 75% headroom
      ramBytes: 24 * 1024 * 1024,     // 60% consumed -> 40% headroom
      writeBytes: 32 * 1024,          // 50% consumed -> 50% headroom
      footprintKeys: 90,              // 90% consumed -> 10% headroom
    },
  });

  const byKey = Object.fromEntries(summary.metrics.map((m) => [m.key, m]));

  assert.equal(byKey.cpuInstructions.consumedPct, 25);
  assert.equal(byKey.cpuInstructions.headroomPct, 75);
  assert.equal(byKey.cpuInstructions.severity, 'safe');

  assert.equal(byKey.ramBytes.consumedPct, 60);
  assert.equal(byKey.ramBytes.headroomPct, 40);
  assert.equal(byKey.ramBytes.severity, 'warning');

  assert.equal(byKey.writeBytes.consumedPct, 50);
  assert.equal(byKey.writeBytes.headroomPct, 50);
  assert.equal(byKey.writeBytes.severity, 'safe');

  assert.equal(byKey.footprintKeys.consumedPct, 90);
  assert.equal(byKey.footprintKeys.headroomPct, 10);
  assert.equal(byKey.footprintKeys.severity, 'critical');

  assert.equal(summary.hasCritical, true);
  assert.equal(summary.exceedsAnyLimit, false);
});

test('computeResourceHeadroom calculates identical transactions per ledger and bottleneck', () => {
  const summary = computeResourceHeadroom({
    usage: {
      cpuInstructions: 25_000_000, // 250M / 25M = 10 tx/ledger
      ramBytes: 20 * 1024 * 1024,  // 200M / 20M = 10 tx/ledger
      writeBytes: 33 * 1024,       // 132K / 33K = 4 tx/ledger
      footprintKeys: 50,           // 250 / 50   = 5 tx/ledger
    },
  });

  const byKey = Object.fromEntries(summary.metrics.map((m) => [m.key, m]));
  assert.equal(byKey.cpuInstructions.txPerLedger, Math.floor(SOROBAN_LEDGER_LIMITS.cpuInstructions / 25_000_000));
  assert.equal(byKey.writeBytes.txPerLedger, 4);
  assert.equal(byKey.footprintKeys.txPerLedger, 5);
  assert.equal(summary.bottleneckTxPerLedger, 4);
});

test('computeResourceHeadroom respects custom per-tx and ledger limit overrides', () => {
  const summary = computeResourceHeadroom({
    usage: {
      cpuInstructions: 40_000_000,
      footprintKeys: 10,
    },
    limits: {
      cpuInstructions: 50_000_000,
    },
    ledgerLimits: {
      cpuInstructions: 120_000_000,
      footprintKeys: 100,
    },
  });

  const cpu = summary.metrics.find((m) => m.key === 'cpuInstructions');
  const keys = summary.metrics.find((m) => m.key === 'footprintKeys');
  assert.equal(cpu.consumedPct, 80);
  assert.equal(cpu.headroomPct, 20);
  assert.equal(cpu.severity, 'warning');
  assert.equal(cpu.txPerLedger, 3);
  assert.equal(keys.txPerLedger, 10);
  assert.equal(summary.bottleneckTxPerLedger, 3);
});

test('computeResourceHeadroom flags Exceeds Network Limit when any metric surpasses limit', () => {
  const summary = computeResourceHeadroom({
    usage: {
      cpuInstructions: 120_000_000, // 120% -> -20% headroom, exceeds limit
      ramBytes: 10 * 1024 * 1024,
      writeBytes: 8 * 1024,
      footprintKeys: 12,
    },
  });

  const cpu = summary.metrics.find((m) => m.key === 'cpuInstructions');
  assert.equal(cpu.exceedsLimit, true);
  assert.equal(cpu.consumedPct, 120);
  assert.equal(cpu.headroomPct, -20);
  assert.equal(cpu.remainingHeadroomPct, 0);
  assert.equal(cpu.txPerLedger, 0);
  assert.equal(cpu.severity, 'critical');
  assert.equal(summary.exceedsAnyLimit, true);
  assert.equal(summary.hasCritical, true);
  assert.equal(summary.bottleneckTxPerLedger, 0);
});

test('getHeadroomSeverity transitions green (<60), amber (60-85), pulsing red (>85)', () => {
  assert.equal(getHeadroomSeverity(0), 'safe');
  assert.equal(getHeadroomSeverity(59.9), 'safe');
  assert.equal(getHeadroomSeverity(60), 'warning');
  assert.equal(getHeadroomSeverity(85), 'warning');
  assert.equal(getHeadroomSeverity(85.1), 'critical');
  assert.equal(getHeadroomSeverity(110), 'critical');
});

test('ResourceLabel component supports legacy percentage props and renders Exceeds Network Limit badge', () => {
  const summary = computeResourceHeadroom({
    cpuUsage: 70,
    ramUsage: 40,
    footprintUsage: 105,
  });
  assert.equal(summary.exceedsAnyLimit, true);
  assert.equal(summary.hasCritical, true);
  assert.match(COMPONENT_SOURCE, /Exceeds Network Limit/);
  assert.match(COMPONENT_SOURCE, /animate-pulse/);
  assert.match(COMPONENT_SOURCE, /headroom/);
  assert.match(COMPONENT_SOURCE, /tx\/ledger/);
});
