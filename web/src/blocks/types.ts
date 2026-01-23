import type { RobotAction } from '../engine/robot';

export type ConditionType =
  | 'AHEAD_CLEAR'
  | 'ON_RAFT'
  | 'ON_GOAL'
  | 'ON_PRESSURE_PLATE'
  | 'RIGHT_CLEAR'
  | 'LEFT_CLEAR';

export type ConditionNode =
  | { kind: 'primitive'; condition: ConditionType }
  | { kind: 'not'; operand: ConditionNode }
  | { kind: 'and'; left: ConditionNode; right: ConditionNode }
  | { kind: 'or'; left: ConditionNode; right: ConditionNode };

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
  condition: ConditionNode;
  body: ProgramNode;
  blockId: string;
}

export interface IfNode {
  type: 'if';
  condition: ConditionNode;
  thenBranch: ProgramNode;
  elseBranch?: ProgramNode;
  blockId: string;
}

export type AstNode = ActionNode | RepeatNode | RepeatUntilNode | IfNode;

export interface ProgramNode {
  type: 'sequence';
  steps: AstNode[];
}
