/* ============================================================================
 * CivilGenius v24 — project persistence (LocalStorage) + JSON import/export
 *   Lets the engineer keep several projects, reload them later, and move a
 *   project between machines as a plain .json file.
 *
 *   Wave-2 (Phase 12): the file format carries inputs for ALL 8 modules.
 *   normalizeProject() keeps the historical contract — the three core modules
 *   (foundation/beam/column) are mandatory — and backfills the five newer
 *   modules (slab/wall/stair/ramp/joint) from their defaults when absent or
 *   malformed, so legacy 3-module project files keep loading. Malformed or
 *   non-object payloads are rejected (null), never half-applied.
 *
 *   NOTE: KEY and `v: 22` are historical persistence semantics kept on
 *   purpose (storage compatibility); the user-facing app version lives in
 *   src/lib/version.ts.
 * ========================================================================== */

import type { BeamInput, ColumnInput, FoundationInput } from './engine';
import {
  DEFAULT_JOINT,
  DEFAULT_RAMP,
  DEFAULT_SLAB,
  DEFAULT_STAIR,
  DEFAULT_WALL,
  type JointInput,
  type SlabInput,
  type StairInput,
  type WallInput,
} from './modules';
import { DEFAULT_MULTIPLIERS, type Multipliers } from './store';

export interface ProjectFile {
  v: 22;
  name: string;
  client: string;
  savedAt: number;
  inputs: {
    foundation: FoundationInput;
    beam: BeamInput;
    column: ColumnInput;
    slab: SlabInput;
    wall: WallInput;
    stair: StairInput;
    ramp: StairInput;
    joint: JointInput;
  };
  multipliers: Multipliers;
}

const KEY = 'civilgenius.projects.v22';

function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/**
 * Normalize an unknown persisted/imported payload into a safe ProjectFile.
 * Returns null when the payload is not a usable project (missing/non-object,
 * or any of the three core module inputs missing/non-object).
 */
export function normalizeProject(raw: unknown): ProjectFile | null {
  if (!isRecord(raw)) return null;
  const inputs = raw.inputs;
  if (!isRecord(inputs)) return null;

  // core-3 are the historical contract — all must be present and object-like
  if (!isRecord(inputs.foundation) || !isRecord(inputs.beam) || !isRecord(inputs.column)) return null;

  // newer-5 backfill from defaults when absent or malformed
  const slab = isRecord(inputs.slab) ? (inputs.slab as unknown as SlabInput) : { ...DEFAULT_SLAB };
  const wall = isRecord(inputs.wall) ? (inputs.wall as unknown as WallInput) : { ...DEFAULT_WALL };
  const stair = isRecord(inputs.stair) ? (inputs.stair as unknown as StairInput) : { ...DEFAULT_STAIR };
  const ramp = isRecord(inputs.ramp) ? (inputs.ramp as unknown as StairInput) : { ...DEFAULT_RAMP };
  const joint = isRecord(inputs.joint) ? (inputs.joint as unknown as JointInput) : { ...DEFAULT_JOINT };

  // multipliers merge: keep only finite numeric entries over the defaults
  const merged: Multipliers = { ...DEFAULT_MULTIPLIERS };
  if (isRecord(raw.multipliers)) {
    for (const k of Object.keys(DEFAULT_MULTIPLIERS) as (keyof Multipliers)[]) {
      const v = raw.multipliers[k];
      if (typeof v === 'number' && Number.isFinite(v)) merged[k] = v;
    }
  }

  return {
    v: 22,
    name: typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name : 'پروژه بدون نام',
    client: typeof raw.client === 'string' ? raw.client : 'کارفرما: —',
    savedAt: typeof raw.savedAt === 'number' && Number.isFinite(raw.savedAt) ? raw.savedAt : Date.now(),
    inputs: {
      foundation: inputs.foundation as unknown as FoundationInput,
      beam: inputs.beam as unknown as BeamInput,
      column: inputs.column as unknown as ColumnInput,
      slab,
      wall,
      stair,
      ramp,
      joint,
    },
    multipliers: merged,
  };
}

export function listProjects(): ProjectFile[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.map((p) => normalizeProject(p)).filter((p): p is ProjectFile => p !== null);
  } catch {
    return [];
  }
}

export function saveProject(p: ProjectFile): void {
  if (!hasStorage()) return;
  const all = listProjects().filter((x) => x.name !== p.name);
  all.unshift(p);
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, 30)));
}

export function deleteProject(name: string): void {
  if (!hasStorage()) return;
  localStorage.setItem(KEY, JSON.stringify(listProjects().filter((x) => x.name !== name)));
}

export function exportProjectJSON(p: ProjectFile): Blob {
  return new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
}

export function parseProjectJSON(text: string): ProjectFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('فایل پروژه نامعتبر است');
  }
  const p = normalizeProject(parsed);
  if (!p) throw new Error('فایل پروژه نامعتبر است');
  return p;
}
