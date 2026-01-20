import type { RobotAction, RobotState } from '../engine/robot';
import { getForwardPosition } from '../engine/rules';
import { isGoal, isHazard, isWall, type World } from '../engine/world';
import type { ActionNode, ConditionType, ProgramNode } from './types';

export type VmStatus = 'running' | 'done' | 'step_limit';

export interface VmContext {
  world: World;
  robot: RobotState;
}

interface SequenceFrame {
  kind: 'sequence';
  node: ProgramNode;
  index: number;
}

interface RepeatFrame {
  kind: 'repeat';
  node: ProgramNode;
  index: number;
  remaining: number;
}

type Frame = SequenceFrame | RepeatFrame;

export interface VmState {
  program: ProgramNode;
  stack: Frame[];
  status: VmStatus;
  steps: number;
  maxSteps: number;
  currentNode?: ActionNode;
}

export interface VmStepResult {
  state: VmState;
  action?: RobotAction;
}

export const createVm = (program: ProgramNode, maxSteps = 200): VmState => ({
  program,
  stack: [{ kind: 'sequence', node: program, index: 0 }],
  status: 'running',
  steps: 0,
  maxSteps,
});

const evaluateCondition = (condition: ConditionType, context: VmContext): boolean => {
  const { world, robot } = context;

  switch (condition) {
    case 'PATH_AHEAD_CLEAR': {
      const forward = getForwardPosition(robot, robot.direction);
      return !isWall(world, forward.x, forward.y);
    }
    case 'ON_GOAL':
      return isGoal(world, robot.x, robot.y);
    case 'ON_HAZARD':
      return isHazard(world, robot.x, robot.y);
    default:
      return false;
  }
};

const cloneStack = (stack: Frame[]): Frame[] =>
  stack.map((frame) => ({
    ...frame,
  }));

export const stepVm = (state: VmState, context: VmContext): VmStepResult => {
  if (state.status !== 'running') {
    return { state };
  }

  if (state.steps >= state.maxSteps) {
    return {
      state: {
        ...state,
        status: 'step_limit',
        currentNode: undefined,
      },
    };
  }

  const stack = cloneStack(state.stack);

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];

    if (frame.kind === 'repeat') {
      if (frame.remaining <= 0) {
        stack.pop();
        continue;
      }

      if (frame.index >= frame.node.steps.length) {
        frame.remaining -= 1;
        frame.index = 0;

        if (frame.remaining <= 0) {
          stack.pop();
        }
        continue;
      }
    }

    if (frame.index >= frame.node.steps.length) {
      stack.pop();
      continue;
    }

    const node = frame.node.steps[frame.index];
    frame.index += 1;

    if (node.type === 'action') {
      const nextState: VmState = {
        ...state,
        stack,
        steps: state.steps + 1,
        currentNode: node,
      };

      return { state: nextState, action: node.action };
    }

    if (node.type === 'repeat') {
      if (node.count > 0) {
        stack.push({
          kind: 'repeat',
          node: node.body,
          index: 0,
          remaining: node.count,
        });
      }
      continue;
    }

    if (node.type === 'if') {
      const conditionMet = evaluateCondition(node.condition, context);
      const branch = conditionMet ? node.thenBranch : node.elseBranch;
      if (branch && branch.steps.length > 0) {
        stack.push({ kind: 'sequence', node: branch, index: 0 });
      }
    }
  }

  return {
    state: {
      ...state,
      stack,
      status: 'done',
      currentNode: undefined,
    },
  };
};
