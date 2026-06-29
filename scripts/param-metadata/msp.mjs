/**
 * Generate bundled MSP (iNav + Betaflight) parameter metadata.
 *
 * The GCS surfaces MSP firmware as a fixed set of virtual parameters; this
 * provides the enum/bitmask metadata for the ones that have it: FEATURE_FLAGS
 * (the feature bitmask), FAILSAFE_PROCEDURE (an enum), and DISARM_KILL_SWITCH
 * (on/off). Feature bit labels are sourced from the firmware so they are exact.
 * Run on demand:  node scripts/param-metadata/msp.mjs
 *
 * @license GPL-3.0-only
 */

import { join } from "node:path";
import { PUBLIC_DIR, httpsGetBuffer, writeSnapshot, compact } from "./_shared.mjs";

const text = async (url) => (await httpsGetBuffer(url)).toString("utf8");

/** Parse iNav's bit-indexed featureNames[] (array index = bit; "" = reserved). */
async function inavFeatureBits() {
  const src = await text("https://raw.githubusercontent.com/iNavFlight/inav/master/src/main/fc/cli.c");
  const m = src.match(/featureNames\[\][^=]*=\s*\{([\s\S]*?)\}/);
  if (!m) return undefined;
  const items = m[1].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
  const bits = [];
  items.forEach((label, bit) => {
    if (label && label !== "NULL" && label !== "") bits.push([bit, label]);
  });
  return bits.length ? bits : undefined;
}

/** Parse a quoted-string lookup table body into index→label entries. */
function tableEntries(body) {
  const out = [];
  body.split(",").map((s) => s.trim().replace(/^"|"$/g, "")).forEach((label, i) => {
    if (label) out.push([i, label]);
  });
  return out.length ? out : undefined;
}

async function inavFailsafeProcedure() {
  const y = await text("https://raw.githubusercontent.com/iNavFlight/inav/master/src/main/fc/settings.yaml");
  const m = y.match(/name:\s*failsafe_procedure\s*\n\s*values:\s*\[([^\]]*)\]/);
  return m ? tableEntries(m[1]) : undefined;
}

async function bfFailsafeProcedure() {
  const s = await text("https://raw.githubusercontent.com/betaflight/betaflight/master/src/main/cli/settings.c");
  const m = s.match(/failsafeProcedure\[\][^=]*=\s*\{([^}]*)\}/);
  return m ? tableEntries(m[1]) : undefined;
}

/** Parse Betaflight features_e (FEATURE_X = 1 << N) — only if unambiguous. */
async function bfFeatureBits() {
  for (const p of ["src/main/fc/feature.h", "src/main/fc/runtime_config.h", "src/main/config/feature.h"]) {
    try {
      const s = await text(`https://raw.githubusercontent.com/betaflight/betaflight/master/${p}`);
      const e = s.match(/typedef enum\s*\{([\s\S]*?)\}\s*features_e/);
      if (!e) continue;
      const bits = [];
      for (const line of e[1].split("\n")) {
        const m = line.match(/FEATURE_([A-Z0-9_]+)\s*=\s*1\s*<<\s*(\d+)/);
        if (m && !/UNUSED|RESERVED/.test(m[1])) bits.push([parseInt(m[2], 10), m[1]]);
      }
      if (bits.length) return bits;
    } catch { /* try next path */ }
  }
  return undefined; // not sourced → ship no BF feature bits (Rule 44: no guessed labels)
}

const ON_OFF = [[0, "OFF"], [1, "ON"]];

function buildParams({ featureBits, failsafe }) {
  const params = [];
  if (featureBits) {
    params.push(compact({
      name: "FEATURE_FLAGS",
      humanName: "Features",
      description: "Enabled firmware features (bitmask).",
      bitmask: featureBits,
      valueType: "uint32",
    }));
  }
  if (failsafe) {
    params.push(compact({
      name: "FAILSAFE_PROCEDURE",
      humanName: "Failsafe Procedure",
      description: "Action taken when the failsafe triggers.",
      values: failsafe,
      valueType: "uint8",
    }));
  }
  params.push(compact({
    name: "DISARM_KILL_SWITCH",
    humanName: "Disarm Kill Switch",
    description: "Instantly disarm on the arm switch regardless of throttle.",
    values: ON_OFF,
    valueType: "uint8",
  }));
  return params.sort((a, b) => a.name.localeCompare(b.name));
}

// iNav
const inav = buildParams({ featureBits: await inavFeatureBits(), failsafe: await inavFailsafeProcedure() });
console.log(`inav: ${await writeSnapshot(
  join(PUBLIC_DIR, "inav.json.gz"),
  { firmware: "inav", version: "latest", sourceUrl: "iNav firmware settings", generatedAt: new Date().toISOString() },
  inav, 1,
)} params`);

// Betaflight
const bf = buildParams({ featureBits: await bfFeatureBits(), failsafe: await bfFailsafeProcedure() });
console.log(`betaflight: ${await writeSnapshot(
  join(PUBLIC_DIR, "betaflight.json.gz"),
  { firmware: "betaflight", version: "latest", sourceUrl: "Betaflight firmware settings", generatedAt: new Date().toISOString() },
  bf, 1,
)} params`);
