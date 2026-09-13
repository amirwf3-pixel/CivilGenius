
/* ============================================================================
 * CivilGenius v22 — project persistence (LocalStorage) + JSON import/export
 *   Lets the engineer keep several projects, reload them later, and move a
 *   project between machines as a plain .json file.
 * ========================================================================== */

import type { BeamInput, ColumnInput, FoundationInput } from './engine';
import type { Multipliers } from './store';

export interface ProjectFile {
  v: 22;
  name: string;
  client: string;
  savedAt: number;
  inputs: { foundation: FoundationInput; beam: BeamInput; column: ColumnInput };
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

export function listProjects(): ProjectFile[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as ProjectFile[]) : [];
    return Array.isArray(arr) ? arr : [];
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
  const o = JSON.parse(text) as ProjectFile;
  if (!o || typeof o !== 'object' || !o.inputs || !o.inputs.foundation || !o.inputs.beam || !o.inputs.column) {
    throw new Error('فایل پروژه نامعتبر است');
  }
  return o;
}


