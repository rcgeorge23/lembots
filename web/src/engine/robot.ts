export type Direction = 0 | 1 | 2 | 3;

export type RobotAction =
  | 'MOVE_FORWARD'
  | 'TURN_LEFT'
  | 'TURN_RIGHT'
  | 'WAIT';

export interface RobotState {
  id: string;
  x: number;
  y: number;
  direction: Direction;
  alive: boolean;
  reachedGoal: boolean;
}

export const createRobotState = (
  x: number,
  y: number,
  direction: Direction,
  id = 'robot-1',
): RobotState => ({
  id,
  x,
  y,
  direction,
  alive: true,
  reachedGoal: false,
});
