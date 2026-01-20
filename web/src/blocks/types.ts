import type { RobotAction } from '../engine/robot';

export type ConditionType =
  | 'PATH_AHEAD_CLEAR'
  | 'ON_GOAL'
  | 'HAZARD_AHEAD'
  | 'HAZARD_RIGHT'
  | 'WALL_RIGHT'
  | 'HAZARD_LEFT'
  | 'WALL_LEFT'
  | 'GLOBAL_SIGNAL_ON';

export interface ActionNode {
  type: 'action';
  action: RobotAction;
  blockId: string;
}

export interface RepeatNode {
  type: 'repeat';
  count: number;
  body: ProgramNode;
  blockId: string;
}

export interface RepeatUntilNode {
  type: 'repeat_until';
  condition: ConditionType;
  body: ProgramNode;
  blockId: string;
}

export interface IfNode {
  type: 'if';
  condition: ConditionType;
  thenBranch: ProgramNode;
  elseBranch?: ProgramNode;
  blockId: string;
}

export type AstNode = ActionNode | RepeatNode | RepeatUntilNode | IfNode;

export interface ProgramNode {
  type: 'sequence';
  steps: AstNode[];
}
