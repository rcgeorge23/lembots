import type { RobotAction } from '../engine/robot';

export type ConditionType = 'PATH_AHEAD_CLEAR' | 'ON_GOAL' | 'ON_HAZARD';

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

export interface IfNode {
  type: 'if';
  condition: ConditionType;
  thenBranch: ProgramNode;
  elseBranch?: ProgramNode;
  blockId: string;
}

export type AstNode = ActionNode | RepeatNode | IfNode;

export interface ProgramNode {
  type: 'sequence';
  steps: AstNode[];
}
