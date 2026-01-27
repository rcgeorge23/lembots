import type { RobotAction } from '../engine/robot';

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
