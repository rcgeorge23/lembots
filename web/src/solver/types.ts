import type { Direction, RobotAction, RobotState } from '../engine/robot';

export interface SolverLevelDefinition {
  id?: string;
  name?: string;
  grid: number[][];
  spawner?: {
    x: number;
    y: number;
    dir: number | 'N' | 'E' | 'S' | 'W';
    count: number;
    intervalTicks: number;
    starts?: { x: number; y: number; dir: number | 'N' | 'E' | 'S' | 'W' }[];
  };
  exits?: { x: number; y: number }[];
  requiredSaved?: number;
  maxTicks?: number;
  start?: { x: number; y: number; dir: number };
  goal?: { x: number; y: number };
}

export interface TraceLiteFrame {
  id: string;
  x: number;
  y: number;
  dir: Direction;
  status: 'alive' | 'dead' | 'saved';
}

export interface TraceLite {
  sampleEvery: number;
  frames: TraceLiteFrame[][];
}

export interface EventSummary {
  doorOpened: boolean;
  pressurePlatePressed: boolean;
  raftUsed: boolean;
  waterTouched: boolean;
  anySaved: boolean;
}

export interface EvalOptions {
  maxTicks?: number;
  maxVmSteps?: number;
  sampleEvery?: number;
}

export interface EvalResult {
  solved: boolean;
  score: number;
  ticks: number;
  finalRobots: RobotState[];
  bestRobots?: RobotState[];
  events: EventSummary;
  traceLite?: TraceLite;
}

export interface SolverSearchOptions {
  maxAttempts?: number;
  maxTimeMs?: number;
  maxDepth?: number;
  beamWidth?: number;
  progressEvery?: number;
  seed?: number;
  actions: RobotAction[];
  conditions?: SolverConditionType[];
}

export interface SolverWorkerStartPayload {
  level: SolverLevelDefinition;
  evalOptions?: EvalOptions;
  search: SolverSearchOptions;
}

export interface SolverWorkerProgressPayload {
  attemptCount: number;
  bestScore: number;
  elapsedMs: number;
  bestProgram?: SolverProgram;
  bestTrace?: TraceLite;
}

export interface SolverWorkerResultPayload extends SolverWorkerProgressPayload {
  solved: boolean;
}

export type SolverWorkerMessage =
  | { type: 'start'; payload: SolverWorkerStartPayload }
  | { type: 'cancel' };

export type SolverWorkerResponse =
  | { type: 'progress'; payload: SolverWorkerProgressPayload }
  | { type: 'result'; payload: SolverWorkerResultPayload };

export type SolverConditionType =
  | 'AHEAD_CLEAR'
  | 'LEFT_CLEAR'
  | 'RIGHT_CLEAR'
  | 'ON_GOAL'
  | 'ON_PRESSURE_PLATE'
  | 'ON_RAFT';

export type SolverConditionNode =
  | { kind: 'primitive'; condition: SolverConditionType }
  | { kind: 'not'; operand: SolverConditionNode }
  | { kind: 'and'; left: SolverConditionNode; right: SolverConditionNode }
  | { kind: 'or'; left: SolverConditionNode; right: SolverConditionNode };

export interface SolverActionNode {
  type: 'action';
  action: RobotAction;
}

export interface SolverIfNode {
  type: 'if';
  condition: SolverConditionNode;
  thenBranch: SolverProgram;
  elseBranch?: SolverProgram;
}

export interface SolverRepeatNode {
  type: 'repeat';
  count: number;
  body: SolverProgram;
}

export interface SolverRepeatUntilNode {
  type: 'repeat_until';
  condition: SolverConditionNode;
  body: SolverProgram;
}

export type SolverAstNode =
  | SolverActionNode
  | SolverIfNode
  | SolverRepeatNode
  | SolverRepeatUntilNode;

export interface SolverProgram {
  type: 'sequence';
  steps: SolverAstNode[];
}
