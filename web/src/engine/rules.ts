import type { Direction, RobotAction, RobotState } from './robot';
import { isGoal, isHazard, isWall, type World } from './world';

export interface Position {
  x: number;
  y: number;
}

export const getForwardPosition = (position: Position, direction: Direction): Position => {
  switch (direction) {
    case 0:
      return { x: position.x, y: position.y - 1 };
    case 1:
      return { x: position.x + 1, y: position.y };
    case 2:
      return { x: position.x, y: position.y + 1 };
    case 3:
      return { x: position.x - 1, y: position.y };
    default:
      return position;
  }
};

export const turnLeft = (direction: Direction): Direction =>
  ((direction + 3) % 4) as Direction;

export const turnRight = (direction: Direction): Direction =>
  ((direction + 1) % 4) as Direction;

export const applyAction = (
  world: World,
  robot: RobotState,
  action: RobotAction,
): RobotState => {
  if (!robot.alive || robot.reachedGoal) {
    return robot;
  }

  let nextState = { ...robot };
  let landedOnHazard = false;

  if (action === 'TURN_LEFT') {
    nextState = { ...nextState, direction: turnLeft(nextState.direction) };
  } else if (action === 'TURN_RIGHT') {
    nextState = { ...nextState, direction: turnRight(nextState.direction) };
  } else if (action === 'MOVE_FORWARD') {
    const forward = getForwardPosition(nextState, nextState.direction);
    if (!isWall(world, forward.x, forward.y)) {
      nextState = { ...nextState, x: forward.x, y: forward.y };
      landedOnHazard = isHazard(world, forward.x, forward.y);
    }
  }

  if (landedOnHazard) {
    nextState = { ...nextState, alive: false };
  }

  if (isGoal(world, nextState.x, nextState.y)) {
    nextState = { ...nextState, reachedGoal: true };
  }

  return nextState;
};
