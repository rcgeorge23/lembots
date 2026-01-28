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

const createRng = (seed: number | undefined) => {
  let state = (seed ?? Date.now()) % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

const randomIndex = (rng: () => number, max: number) =>
  Math.floor(rng() * max);

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

const mutateProgram = (
  program: SolverProgram,
  options: SolverSearchOptions,
  rng: () => number,
): SolverProgram => {
  if (options.actions.length === 0) {
    return cloneProgram(program);
  }

  const roll = rng();
  if (program.steps.length === 0 || roll < 0.5) {
    const action = options.actions[randomIndex(rng, options.actions.length)];
    return appendAction(program, action);
  }
  if (roll < 0.8) {
    const index = randomIndex(rng, program.steps.length);
    const action = options.actions[randomIndex(rng, options.actions.length)];
    return {
      type: 'sequence',
      steps: program.steps.map((step, idx) =>
        idx === index ? { type: 'action', action } : { ...step },
      ),
    };
  }
  return trimProgram(program);
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
  const progressEvery = clampPositive(
    options.progressEvery,
    DEFAULT_PROGRESS_EVERY,
  );
  const rng = createRng(options.seed);

  let bestProgram: SolverProgram | undefined;
  let bestEval: EvalResult | undefined;
  let attempts = 0;
  let current: SolverProgram = { type: 'sequence', steps: [] };
  let solved = false;
  let lastProgressAttempt = 0;

  while (attempts < maxAttempts && Date.now() - start < maxTimeMs) {
    attempts += 1;

    current = mutateProgram(current, options, rng);
    if (current.steps.length > maxDepth) {
      current = trimProgram(current);
      continue;
    }

    const evaluation = evaluate(current, level, evalOptions);
    if (!bestEval || evaluation.score > bestEval.score) {
      bestEval = evaluation;
      bestProgram = cloneProgram(current);
    }

    if (evaluation.solved) {
      solved = true;
      break;
    }

    if (attempts - lastProgressAttempt >= progressEvery) {
      lastProgressAttempt = attempts;
      onProgress?.({
        attemptCount: attempts,
        bestScore: bestEval?.score ?? -Infinity,
        elapsedMs: Date.now() - start,
        bestProgram,
        bestTrace: bestEval?.traceLite,
      });
    }
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
