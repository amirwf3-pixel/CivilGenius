
/* ============================================================================
 * CivilGenius v20 — global store
 *   • StoreCtx      : project state (inputs, result, multipliers, history)
 *   • useStageCompute : staged progress for the compute button, with a
 *     guaranteed release (round-3 fix: the button used to spin forever when
 *     projectCode() threw on the invalid Persian locale tag).
 *   • buildSampleProject : instant demo building for presentations
 * ========================================================================== */

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  calculateBeam,
  calculateColumn,
  calculateFoundation,
  DEFAULT_BEAM,
  DEFAULT_COLUMN,
  DEFAULT_FOUNDATION,
  type AnyInput,
  type BeamInput,
  type CalcResult,
  type CalcType,
  type ColumnInput,
  type FoundationInput,
} from './engine';
import {
  calculateJoint,
  calculateRamp,
  calculateSlab,
  calculateStair,
  calculateWall,
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
import type { MarketSnapshot } from './market';

export interface Multipliers {
  foundations: number;
  beams: number;
  columns: number;
  slabs: number;
  walls: number;
  stairs: number;
  joints: number;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'info' | 'warn' | 'bad';
}

export interface StoreValue {
  projectName: string;
  client: string;
  setProjectName: (v: string) => void;
  setClient: (v: string) => void;
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
  setInput: <T extends CalcType>(type: T, value: AnyInput) => void;
  results: Partial<Record<CalcType, CalcResult>>;
  setResult: (type: CalcType, result: CalcResult) => void;
  recent: CalcResult[];
  multipliers: Multipliers;
  setMultipliers: (m: Multipliers) => void;
  toasts: Toast[];
  pushToast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  loadSample: () => void;
  /** live market snapshot, kept in a ref so non-React code can read it */
  marketRef: { current: MarketSnapshot };
}

export const StoreCtx = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used inside <StoreCtx.Provider>');
  return ctx;
}

/* --------------------------------------------------------------- compute -- */

export const COMPUTE_STAGES = [
  'بررسی ورودی‌ها',
  'محاسبه ظرفیت و باربری',
  'کنترل مقاطع و آرماتور',
  'تولید متره و برآورد',
  'آماده‌سازی نتایج',
] as const;

export interface StageState {
  busy: boolean;
  step: number;
  label: string;
  error: string | null;
}

/**
 * Staged progress with a guaranteed release. The heavy math is deferred to a
 * macrotask so the progress ring can paint, and any throw — including the old
 * RangeError from an invalid Intl locale tag — still lands in `finally`.
 */
export function useStageCompute(): {
  stage: StageState;
  run: (type: CalcType, input: AnyInput, onDone: (r: CalcResult) => void) => Promise<void>;
} {
  const [stage, setStage] = useState<StageState>({ busy: false, step: 0, label: '', error: null });
  const tokenRef = useRef(0);

  const run = useCallback(
    async (type: CalcType, input: AnyInput, onDone: (r: CalcResult) => void) => {
      const token = ++tokenRef.current;
      const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      try {
        setStage({ busy: true, step: 0, label: COMPUTE_STAGES[0], error: null });
        for (let i = 0; i < COMPUTE_STAGES.length; i++) {
          if (token !== tokenRef.current) return;
          setStage({ busy: true, step: i, label: COMPUTE_STAGES[i], error: null });
          await sleep(90);
        }
        // real calculation (synchronous, but deferred so the UI can paint)
        const result = await new Promise<CalcResult>((resolve, reject) => {
          setTimeout(() => {
            try {
              switch (type) {
                case 'foundation':
                  resolve(calculateFoundation(input as FoundationInput));
                  break;
                case 'beam':
                  resolve(calculateBeam(input as BeamInput));
                  break;
                case 'column':
                  resolve(calculateColumn(input as ColumnInput));
                  break;
                case 'slab':
                  resolve(calculateSlab(input as SlabInput));
                  break;
                case 'wall':
                  resolve(calculateWall(input as WallInput));
                  break;
                case 'stair':
                  resolve(calculateStair(input as StairInput));
                  break;
                case 'ramp':
                  resolve(calculateRamp(input as StairInput));
                  break;
                case 'joint':
                  resolve(calculateJoint(input as JointInput));
                  break;
              }
            } catch (err) {
              reject(err);
            }
          }, 0);
        });
        if (token !== tokenRef.current) return;
        onDone(result);
      } catch (err) {
        if (token !== tokenRef.current) return;
        const message = err instanceof Error ? err.message : 'خطای نامشخص در محاسبه';
        setStage({ busy: false, step: 0, label: '', error: message });
        return;
      } finally {
        if (token === tokenRef.current) {
          setStage((prev) => ({ ...prev, busy: false, label: '' }));
        }
      }
    },
    [],
  );

  return { stage, run };
}

/* ------------------------------------------------------------ sample data -- */

export interface SampleProject {
  projectName: string;
  client: string;
  foundation: FoundationInput;
  beam: BeamInput;
  column: ColumnInput;
  slab: SlabInput;
  wall: WallInput;
  stair: StairInput;
  ramp: StairInput;
  joint: JointInput;
  multipliers: Multipliers;
}

/** 5-story residential demo used by "پروژه نمونه ارائه" and the management room. */
export function buildSampleProject(): SampleProject {
  return {
    projectName: 'ساختمان مسکونی ۵ طبقه — پلاک ۱۲/۳',
    client: 'شرکت ساختمانی سازه پایدار',
    foundation: { ...DEFAULT_FOUNDATION, L: 22, B: 14, H: 1.4, Df: 2.2, cs: 600, c: 25, phi: 30, gamma: 18, P: 9600, Fc: 25, Fy: 400, cover: 50, barDia: 16, FS: 3, mixMode: 'ready' },
    beam: { ...DEFAULT_BEAM, L: 7.2, b: 300, h: 600, wd: 22, wl: 12, Fc: 25, Fy: 400, cover: 40, stirrupDia: 10, barDia: 20, support: 'simple' },
    column: { ...DEFAULT_COLUMN, Pu: 2100, Mu: 180, Lc: 3.4, b: 500, h: 500, Fc: 25, Fy: 400, cover: 40, tieDia: 10, barDia: 22, k: 1 },
    slab: { ...DEFAULT_SLAB, L: 6.2, h: 280, LL: 2.5 },
    wall: { ...DEFAULT_WALL, lw: 4.2, tw: 250, hs: 3.2, Pu: 2800, Mu: 4200, Vu: 900 },
    stair: { ...DEFAULT_STAIR, H: 3.2, Lr: 5.8, bw: 1.3 },
    ramp: { ...DEFAULT_RAMP, H: 3.5, Lr: 7, bw: 1.5 },
    joint: { ...DEFAULT_JOINT, colB: 550, colH: 550, beamB: 350, beamH: 600, Vu: 1500 },
    multipliers: { foundations: 1, beams: 12, columns: 16, slabs: 5, walls: 2, stairs: 2, joints: 16 },
  };
}

export const DEFAULT_MULTIPLIERS: Multipliers = { foundations: 1, beams: 12, columns: 16, slabs: 5, walls: 2, stairs: 2, joints: 16 };


