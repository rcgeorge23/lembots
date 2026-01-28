import type {
  SolverWorkerMessage,
  SolverWorkerResponse,
} from './types';
import { runSolverSearch } from './search';

let cancelled = false;

const postResponse = (response: SolverWorkerResponse) => {
  self.postMessage(response);
};

self.addEventListener('message', (event: MessageEvent<SolverWorkerMessage>) => {
  const message = event.data;
  if (message.type === 'cancel') {
    cancelled = true;
    return;
  }

  if (message.type !== 'start') {
    return;
  }

  cancelled = false;
  const { level, evalOptions, search } = message.payload;

  const result = runSolverSearch(level, search, evalOptions, (payload) => {
    if (cancelled) {
      return;
    }
    postResponse({ type: 'progress', payload });
  });

  if (cancelled) {
    return;
  }

  const bestScore = result.state.bestEval?.score ?? -Infinity;
  postResponse({
    type: 'result',
    payload: {
      attemptCount: result.state.attempts,
      bestScore,
      elapsedMs: Date.now() - result.state.startedAt,
      bestProgram: result.state.bestProgram,
      bestTrace: result.state.bestEval?.traceLite,
      solved: result.solved,
    },
  });
});
