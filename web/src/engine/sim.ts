import type { RobotAction, RobotState } from './robot';
import type { World } from './world';
import { applyAction } from './rules';

export type SimulationStatus = 'running' | 'won' | 'lost';

export interface SimulationState {
  world: World;
  robot: RobotState;
  status: SimulationStatus;
  stepCount: number;
  maxSteps: number;
}

export const createSimulation = (
  world: World,
  robot: RobotState,
  maxSteps = 200,
): SimulationState => ({
  world,
  robot,
  status: robot.reachedGoal ? 'won' : 'running',
  stepCount: 0,
  maxSteps,
});

export const stepSimulation = (
  state: SimulationState,
  action: RobotAction,
): SimulationState => {
  if (state.status !== 'running') {
    return state;
  }

  const nextRobot = applyAction(state.world, state.robot, action);
  const stepCount = state.stepCount + 1;

  if (!nextRobot.alive) {
    return { ...state, robot: nextRobot, status: 'lost', stepCount };
  }

  if (nextRobot.reachedGoal) {
    return { ...state, robot: nextRobot, status: 'won', stepCount };
  }

  if (stepCount >= state.maxSteps) {
    return { ...state, robot: nextRobot, status: 'lost', stepCount };
  }

  return { ...state, robot: nextRobot, stepCount };
};
