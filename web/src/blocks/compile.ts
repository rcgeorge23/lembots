import * as Blockly from 'blockly';
import type { AstNode, ConditionNode, ProgramNode } from './types';

const compileCondition = (block: Blockly.Block | null): ConditionNode => {
  if (!block) {
    throw new Error('Missing condition block.');
  }

  switch (block.type) {
    case 'lembot_path_ahead_clear':
      return { kind: 'primitive', condition: 'PATH_AHEAD_CLEAR' };
    case 'lembot_on_goal':
      return { kind: 'primitive', condition: 'ON_GOAL' };
    case 'lembot_hazard_ahead':
      return { kind: 'primitive', condition: 'HAZARD_AHEAD' };
    case 'lembot_hazard_right':
      return { kind: 'primitive', condition: 'HAZARD_RIGHT' };
    case 'lembot_wall_right':
      return { kind: 'primitive', condition: 'WALL_RIGHT' };
    case 'lembot_hazard_left':
      return { kind: 'primitive', condition: 'HAZARD_LEFT' };
    case 'lembot_wall_left':
      return { kind: 'primitive', condition: 'WALL_LEFT' };
    case 'lembot_signal_active':
      return { kind: 'primitive', condition: 'GLOBAL_SIGNAL_ON' };
    case 'lembot_logic_not': {
      const operandBlock = block.getInputTargetBlock('OPERAND');
      return { kind: 'not', operand: compileCondition(operandBlock) };
    }
    case 'lembot_logic_and': {
      const leftBlock = block.getInputTargetBlock('LEFT');
      const rightBlock = block.getInputTargetBlock('RIGHT');
      return {
        kind: 'and',
        left: compileCondition(leftBlock),
        right: compileCondition(rightBlock),
      };
    }
    case 'lembot_logic_or': {
      const leftBlock = block.getInputTargetBlock('LEFT');
      const rightBlock = block.getInputTargetBlock('RIGHT');
      return {
        kind: 'or',
        left: compileCondition(leftBlock),
        right: compileCondition(rightBlock),
      };
    }
    default:
      throw new Error(`Unsupported condition block: ${block.type}`);
  }
};

const compileBlock = (block: Blockly.Block): AstNode => {
  switch (block.type) {
    case 'lembot_move_forward':
      return { type: 'action', action: 'MOVE_FORWARD', blockId: block.id };
    case 'lembot_turn_left':
      return { type: 'action', action: 'TURN_LEFT', blockId: block.id };
    case 'lembot_turn_right':
      return { type: 'action', action: 'TURN_RIGHT', blockId: block.id };
    case 'lembot_wait':
      return { type: 'action', action: 'WAIT', blockId: block.id };
    case 'lembot_signal_on':
      return { type: 'action', action: 'SIGNAL_ON', blockId: block.id };
    case 'lembot_signal_off':
      return { type: 'action', action: 'SIGNAL_OFF', blockId: block.id };
    case 'lembot_repeat': {
      const rawCount = Number(block.getFieldValue('COUNT'));
      const count = Number.isFinite(rawCount) ? Math.max(0, rawCount) : 0;
      const bodyBlock = block.getInputTargetBlock('DO');
      return {
        type: 'repeat',
        count,
        body: compileBlockChain(bodyBlock),
        blockId: block.id,
      };
    }
    case 'lembot_repeat_until': {
      const conditionBlock = block.getInputTargetBlock('CONDITION');
      const bodyBlock = block.getInputTargetBlock('DO');
      return {
        type: 'repeat_until',
        condition: compileCondition(conditionBlock),
        body: compileBlockChain(bodyBlock),
        blockId: block.id,
      };
    }
    case 'lembot_if': {
      const conditionBlock = block.getInputTargetBlock('CONDITION');
      const thenBlock = block.getInputTargetBlock('THEN');
      const elseBlock = block.getInputTargetBlock('ELSE');
      const elseBranch = elseBlock ? compileBlockChain(elseBlock) : undefined;
      return {
        type: 'if',
        condition: compileCondition(conditionBlock),
        thenBranch: compileBlockChain(thenBlock),
        elseBranch,
        blockId: block.id,
      };
    }
    default:
      throw new Error(`Unsupported block: ${block.type}`);
  }
};

export const compileBlockChain = (startBlock: Blockly.Block | null): ProgramNode => {
  const steps: AstNode[] = [];
  let block: Blockly.Block | null = startBlock;

  while (block) {
    steps.push(compileBlock(block));
    block = block.getNextBlock();
  }

  return { type: 'sequence', steps };
};

export const compileWorkspace = (workspace: Blockly.Workspace): ProgramNode => {
  const topBlocks = workspace.getTopBlocks(true);
  const steps: AstNode[] = [];

  topBlocks.forEach((block) => {
    steps.push(...compileBlockChain(block).steps);
  });

  return { type: 'sequence', steps };
};
