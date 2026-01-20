import * as Blockly from 'blockly';

const ACTION_BLOCKS = [
  {
    type: 'lembot_move_forward',
    message0: 'move forward',
    previousStatement: null,
    nextStatement: null,
    colour: 210,
  },
  {
    type: 'lembot_turn_left',
    message0: 'turn left',
    previousStatement: null,
    nextStatement: null,
    colour: 210,
  },
  {
    type: 'lembot_turn_right',
    message0: 'turn right',
    previousStatement: null,
    nextStatement: null,
    colour: 210,
  },
  {
    type: 'lembot_wait',
    message0: 'wait',
    previousStatement: null,
    nextStatement: null,
    colour: 210,
  },
] as const;

const CONTROL_BLOCKS = [
  {
    type: 'lembot_repeat',
    message0: 'repeat %1 times %2 %3',
    args0: [
      {
        type: 'field_number',
        name: 'COUNT',
        value: 2,
        min: 1,
        precision: 1,
      },
      {
        type: 'input_dummy',
      },
      {
        type: 'input_statement',
        name: 'DO',
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 120,
  },
  {
    type: 'lembot_repeat_until',
    message0: 'repeat until %1 %2 %3',
    args0: [
      {
        type: 'input_value',
        name: 'CONDITION',
        check: 'Boolean',
      },
      {
        type: 'input_dummy',
      },
      {
        type: 'input_statement',
        name: 'DO',
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 120,
  },
  {
    type: 'lembot_if',
    message0: 'if %1 then %2 %3 else %4 %5',
    args0: [
      {
        type: 'input_value',
        name: 'CONDITION',
        check: 'Boolean',
      },
      {
        type: 'input_dummy',
      },
      {
        type: 'input_statement',
        name: 'THEN',
      },
      {
        type: 'input_dummy',
      },
      {
        type: 'input_statement',
        name: 'ELSE',
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 120,
  },
] as const;

const CONDITION_BLOCKS = [
  {
    type: 'lembot_path_ahead_clear',
    message0: 'path ahead clear?',
    output: 'Boolean',
    colour: 30,
  },
  {
    type: 'lembot_on_goal',
    message0: 'on goal?',
    output: 'Boolean',
    colour: 30,
  },
  {
    type: 'lembot_on_hazard',
    message0: 'on hazard?',
    output: 'Boolean',
    colour: 30,
  },
  {
    type: 'lembot_hazard_right',
    message0: 'hazard to the right?',
    output: 'Boolean',
    colour: 30,
  },
  {
    type: 'lembot_wall_right',
    message0: 'wall to the right?',
    output: 'Boolean',
    colour: 30,
  },
  {
    type: 'lembot_hazard_left',
    message0: 'hazard to the left?',
    output: 'Boolean',
    colour: 30,
  },
  {
    type: 'lembot_wall_left',
    message0: 'wall to the left?',
    output: 'Boolean',
    colour: 30,
  },
] as const;

export const registerBlocks = (): void => {
  if (Blockly.Blocks['lembot_move_forward']) {
    return;
  }

  Blockly.defineBlocksWithJsonArray([
    ...ACTION_BLOCKS,
    ...CONTROL_BLOCKS,
    ...CONDITION_BLOCKS,
  ]);
};

export const toolboxDefinition = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Actions',
      colour: 210,
      contents: ACTION_BLOCKS.map((block) => ({
        kind: 'block',
        type: block.type,
      })),
    },
    {
      kind: 'category',
      name: 'Control',
      colour: 120,
      contents: [
        {
          kind: 'block',
          type: 'lembot_repeat',
        },
        {
          kind: 'block',
          type: 'lembot_repeat_until',
        },
        {
          kind: 'block',
          type: 'lembot_if',
        },
      ],
    },
    {
      kind: 'category',
      name: 'Conditions',
      colour: 30,
      contents: CONDITION_BLOCKS.map((block) => ({
        kind: 'block',
        type: block.type,
      })),
    },
  ],
};
