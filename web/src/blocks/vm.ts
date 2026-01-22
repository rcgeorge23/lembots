import type { RobotAction, RobotState } from '../engine/robot';
import { getForwardPosition, turnLeft, turnRight } from '../engine/rules';
import { isDoor, isGoal, isHazard, isPressurePlate, isWall, type World } from '../engine/world';
import type { ActionNode, ConditionNode, ConditionType, ProgramNode, RepeatUntilNode } from './types';

export type VmStatus = 'running' | 'done' | 'step_limit';

export interface VmContext {
  world: World;
  robot: RobotState;
  exits: { x: number; y: number }[];
  globalSignal: boolean;
  doorOpen: boolean;
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

interface RepeatUntilFrame {
  kind: 'repeat_until';
  node: RepeatUntilNode;
  index: number;
}

type Frame = SequenceFrame | RepeatFrame | RepeatUntilFrame;

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

const evaluateCondition = (condition: ConditionNode, context: VmContext): boolean => {
  if (condition.kind === 'not') {
    return !evaluateCondition(condition.operand, context);
  }

  if (condition.kind === 'and') {
    return (
      evaluateCondition(condition.left, context) &&
      evaluateCondition(condition.right, context)
    );
  }

  if (condition.kind === 'or') {
    return (
      evaluateCondition(condition.left, context) ||
      evaluateCondition(condition.right, context)
    );
  }

  return evaluatePrimitiveCondition(condition.condition, context);
};

const evaluatePrimitiveCondition = (
  condition: ConditionType,
  context: VmContext,
): boolean => {
  const { world, robot, exits, globalSignal } = context;
  const isOnExit =
    exits.length > 0
      ? exits.some((exit) => exit.x === robot.x && exit.y === robot.y)
      : isGoal(world, robot.x, robot.y);

  switch (condition) {
    case 'PATH_AHEAD_CLEAR': {
      const forward = getForwardPosition(robot, robot.direction);
      return !isWall(world, forward.x, forward.y) &&
        !isHazard(world, forward.x, forward.y) &&
        !(isDoor(world, forward.x, forward.y) && !context.doorOpen);
    }
    case 'ON_GOAL':
      return isOnExit;
    case 'ON_PRESSURE_PLATE':
      return isPressurePlate(world, robot.x, robot.y);
    case 'HAZARD_AHEAD': {
      const forward = getForwardPosition(robot, robot.direction);
      return isHazard(world, forward.x, forward.y);
    }
    case 'RIGHT_CLEAR': {
      const rightDirection = turnRight(robot.direction);
      const right = getForwardPosition(robot, rightDirection);
      return !isWall(world, right.x, right.y) &&
        !isHazard(world, right.x, right.y) &&
        !(isDoor(world, right.x, right.y) && !context.doorOpen);
    }
    case 'LEFT_CLEAR': {
      const leftDirection = turnLeft(robot.direction);
      const left = getForwardPosition(robot, leftDirection);
      return !isWall(world, left.x, left.y) &&
        !isHazard(world, left.x, left.y) &&
        !(isDoor(world, left.x, left.y) && !context.doorOpen);
    }
    case 'GLOBAL_SIGNAL_ON':
      return globalSignal;
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
    const sequenceNode = frame.kind === 'repeat_until' ? frame.node.body : frame.node;

    if (frame.kind === 'repeat_until') {
      if (frame.index === 0 && evaluateCondition(frame.node.condition, context)) {
        stack.pop();
        continue;
      }

      if (frame.index >= sequenceNode.steps.length) {
        frame.index = 0;

        if (evaluateCondition(frame.node.condition, context)) {
          stack.pop();
        }
        continue;
      }
    }

    if (frame.kind === 'repeat') {
      if (frame.remaining <= 0) {
        stack.pop();
        continue;
      }

      if (frame.index >= sequenceNode.steps.length) {
        frame.remaining -= 1;
        frame.index = 0;

        if (frame.remaining <= 0) {
          stack.pop();
        }
        continue;
      }
    }

    if (frame.index >= sequenceNode.steps.length) {
      stack.pop();
      continue;
    }

    const node = sequenceNode.steps[frame.index];
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

    if (node.type === 'repeat_until') {
      stack.push({
        kind: 'repeat_until',
        node,
        index: 0,
      });
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
