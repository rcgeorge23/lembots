import type {
  EvalOptions,
  EvalResult,
  SolverProgram,
  SolverSearchOptions,
  SolverWorkerProgressPayload,
} from './types';
import { evaluate } from './evaluate';

const DEFAULT_PROGRESS_EVERY = 25;

const clampPositive = (value: number | undefined, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
};

const cloneProgram = (program: SolverProgram): SolverProgram => ({
  type: 'sequence',
  steps: program.steps.map((step) => ({ ...step })),
});

const appendAction = (
  program: SolverProgram,
  action: SolverSearchOptions['actions'][number],
): SolverProgram => ({
  type: 'sequence',
  steps: [...program.steps, { type: 'action', action }],
});

const trimProgram = (program: SolverProgram): SolverProgram => {
  if (program.steps.length === 0) {
    return program;
  }
  return {
    type: 'sequence',
    steps: program.steps.slice(0, -1),
  };
};

const expandProgram = (
  program: SolverProgram,
  options: SolverSearchOptions,
): SolverProgram[] => {
  if (options.actions.length === 0) {
    return [cloneProgram(program)];
  }
  return options.actions.map((action) => appendAction(program, action));
};

export interface SearchState {
  bestProgram?: SolverProgram;
  bestEval?: EvalResult;
  attempts: number;
  startedAt: number;
}

export interface SearchResult {
  solved: boolean;
  state: SearchState;
}

export type ProgressCallback = (payload: SolverWorkerProgressPayload) => void;

export const runSolverSearch = (
  level: Parameters<typeof evaluate>[1],
  options: SolverSearchOptions,
  evalOptions: EvalOptions | undefined,
  onProgress?: ProgressCallback,
): SearchResult => {
  const start = Date.now();
  const maxAttempts = clampPositive(options.maxAttempts, 200);
  const maxTimeMs = clampPositive(options.maxTimeMs, 1500);
  const maxDepth = clampPositive(options.maxDepth, 25);
  const beamWidth = clampPositive(options.beamWidth, 20);
  const progressEvery = clampPositive(
    options.progressEvery,
    DEFAULT_PROGRESS_EVERY,
  );

  let bestProgram: SolverProgram | undefined;
  let bestEval: EvalResult | undefined;
  let attempts = 0;
  let solved = false;
  let lastProgressAttempt = 0;
  let frontier: Array<{ program: SolverProgram; eval: EvalResult }> = [];

  const shouldContinue = () =>
    attempts < maxAttempts && Date.now() - start < maxTimeMs;

  const pushProgress = () => {
    if (attempts - lastProgressAttempt < progressEvery) {
      return;
    }
    lastProgressAttempt = attempts;
    onProgress?.({
      attemptCount: attempts,
      bestScore: bestEval?.score ?? -Infinity,
      elapsedMs: Date.now() - start,
      bestProgram,
      bestTrace: bestEval?.traceLite,
    });
  };

  const evaluateCandidate = (program: SolverProgram): EvalResult | undefined => {
    if (!shouldContinue()) {
      return undefined;
    }
    attempts += 1;
    const evaluation = evaluate(program, level, evalOptions);
    if (!bestEval || evaluation.score > bestEval.score) {
      bestEval = evaluation;
      bestProgram = cloneProgram(program);
    }
    if (evaluation.solved) {
      solved = true;
    }
    pushProgress();
    return evaluation;
  };

  const initialProgram: SolverProgram = { type: 'sequence', steps: [] };
  const initialEval = evaluateCandidate(initialProgram);
  if (initialEval) {
    frontier = [{ program: initialProgram, eval: initialEval }];
  }

  for (let depth = 0; depth < maxDepth && shouldContinue() && !solved; depth += 1) {
    const nextLayer: Array<{ program: SolverProgram; eval: EvalResult }> = [];
    const candidates = frontier
      .sort((a, b) => b.eval.score - a.eval.score)
      .slice(0, beamWidth);

    for (const candidate of candidates) {
      if (!shouldContinue() || solved) {
        break;
      }
      const expansions = expandProgram(candidate.program, options);
      for (const expansion of expansions) {
        if (expansion.steps.length > maxDepth || !shouldContinue()) {
          break;
        }
        const evaluation = evaluateCandidate(expansion);
        if (!evaluation) {
          break;
        }
        nextLayer.push({ program: expansion, eval: evaluation });
        if (solved) {
          break;
        }
      }
    }

    if (nextLayer.length === 0) {
      break;
    }
    nextLayer.sort((a, b) => b.eval.score - a.eval.score);
    frontier = nextLayer.slice(0, beamWidth);
  }

  const elapsedMs = Date.now() - start;
  onProgress?.({
    attemptCount: attempts,
    bestScore: bestEval?.score ?? -Infinity,
    elapsedMs,
    bestProgram,
    bestTrace: bestEval?.traceLite,
  });

  return {
    solved,
    state: {
      bestProgram,
      bestEval,
      attempts,
      startedAt: start,
    },
  };
};
