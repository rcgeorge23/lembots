import type { ConditionNode, ProgramNode } from '../blocks/types';
import type { SolverAstNode, SolverConditionNode, SolverProgram } from './types';

interface BlockIdFactory {
  nextId: () => string;
}

const createBlockIdFactory = (): BlockIdFactory => {
  let counter = 0;
  return {
    nextId: () => `solver-${counter += 1}`,
  };
};

const toConditionNode = (condition: SolverConditionNode): ConditionNode => {
  if (condition.kind === 'not') {
    return { kind: 'not', operand: toConditionNode(condition.operand) };
  }

  if (condition.kind === 'and') {
    return {
      kind: 'and',
      left: toConditionNode(condition.left),
      right: toConditionNode(condition.right),
    };
  }

  if (condition.kind === 'or') {
    return {
      kind: 'or',
      left: toConditionNode(condition.left),
      right: toConditionNode(condition.right),
    };
  }

  return { kind: 'primitive', condition: condition.condition };
};

const toAstNode = (node: SolverAstNode, ids: BlockIdFactory): ProgramNode['steps'][number] => {
  switch (node.type) {
    case 'action':
      return { type: 'action', action: node.action, blockId: ids.nextId() };
    case 'if':
      return {
        type: 'if',
        condition: toConditionNode(node.condition),
        thenBranch: toProgramNode(node.thenBranch, ids),
        elseBranch: node.elseBranch ? toProgramNode(node.elseBranch, ids) : undefined,
        blockId: ids.nextId(),
      };
    case 'repeat':
      return {
        type: 'repeat',
        count: node.count,
        body: toProgramNode(node.body, ids),
        blockId: ids.nextId(),
      };
    case 'repeat_until':
      return {
        type: 'repeat_until',
        condition: toConditionNode(node.condition),
        body: toProgramNode(node.body, ids),
        blockId: ids.nextId(),
      };
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
};

export const toProgramNode = (
  program: SolverProgram,
  ids: BlockIdFactory = createBlockIdFactory(),
): ProgramNode => ({
  type: 'sequence',
  steps: program.steps.map((step) => toAstNode(step, ids)),
});
