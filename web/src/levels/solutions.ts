type SolutionAction = 'MOVE_FORWARD' | 'TURN_LEFT' | 'TURN_RIGHT' | 'WAIT';

const actionBlockTypes: Record<SolutionAction, string> = {
  MOVE_FORWARD: 'lembot_move_forward',
  TURN_LEFT: 'lembot_turn_left',
  TURN_RIGHT: 'lembot_turn_right',
  WAIT: 'lembot_wait',
};

const repeatAction = (action: SolutionAction, count: number): SolutionAction[] =>
  Array.from({ length: count }, () => action);

const createIdFactory = (prefix: string) => {
  let index = 0;
  return () => `${prefix}-${index++}`;
};

const wrapXml = (content: string) =>
  `<xml xmlns="https://developers.google.com/blockly/xml">${content}</xml>`;

const buildActionBlocks = (
  actions: SolutionAction[],
  nextId: () => string,
  position?: { x: number; y: number },
): string => {
  if (actions.length === 0) {
    return '';
  }
  const [first, ...rest] = actions;
  const attrs = position ? ` x="${position.x}" y="${position.y}"` : '';
  const nextXml = buildActionBlocks(rest, nextId);
  const next = nextXml ? `<next>${nextXml}</next>` : '';
  return `<block type="${actionBlockTypes[first]}" id="${nextId()}"${attrs}>${next}</block>`;
};

const insertNext = (blockXml: string, nextXml?: string): string => {
  if (!nextXml) {
    return blockXml;
  }
  const closingIndex = blockXml.lastIndexOf('</block>');
  if (closingIndex === -1) {
    return blockXml;
  }
  return `${blockXml.slice(0, closingIndex)}<next>${nextXml}</next>${blockXml.slice(closingIndex)}`;
};

const buildRepeatUntilBlock = (
  conditionType: string,
  bodyBlockXml: string,
  nextId: () => string,
  position?: { x: number; y: number },
): string => {
  const attrs = position ? ` x="${position.x}" y="${position.y}"` : '';
  return `<block type="lembot_repeat_until" id="${nextId()}"${attrs}>` +
    `<value name="CONDITION"><block type="${conditionType}" id="${nextId()}" /></value>` +
    `<statement name="DO">${bodyBlockXml}</statement>` +
    '</block>';
};

const buildRepeatBlock = (
  count: number,
  bodyBlockXml: string,
  nextId: () => string,
  position?: { x: number; y: number },
): string => {
  const attrs = position ? ` x="${position.x}" y="${position.y}"` : '';
  return `<block type="lembot_repeat" id="${nextId()}"${attrs}>` +
    `<field name="COUNT">${count}</field>` +
    `<statement name="DO">${bodyBlockXml}</statement>` +
    '</block>';
};

const buildIfBlock = (
  conditionType: string,
  thenBlockXml: string,
  nextId: () => string,
  options?: { elseBlockXml?: string; position?: { x: number; y: number } },
): string => {
  const attrs = options?.position ? ` x="${options.position.x}" y="${options.position.y}"` : '';
  const elseXml = options?.elseBlockXml ? `<statement name="ELSE">${options.elseBlockXml}</statement>` : '';
  return `<block type="lembot_if" id="${nextId()}"${attrs}>` +
    `<value name="CONDITION"><block type="${conditionType}" id="${nextId()}" /></value>` +
    `<statement name="THEN">${thenBlockXml}</statement>` +
    elseXml +
    '</block>';
};

const buildLevel01Solution = () => {
  const nextId = createIdFactory('level-01');
  const repeatMove = buildRepeatBlock(
    5,
    buildActionBlocks(['MOVE_FORWARD'], nextId),
    nextId,
    { x: 24, y: 24 },
  );
  return wrapXml(repeatMove);
};

const buildLevel02Solution = () => {
  const nextId = createIdFactory('level-02');
  const thenXml = buildActionBlocks(['MOVE_FORWARD'], nextId);
  const elseXml = buildActionBlocks(['TURN_RIGHT', 'MOVE_FORWARD', 'TURN_LEFT'], nextId);
  const ifBlock = buildIfBlock('lembot_wall_right', thenXml, nextId, { elseBlockXml: elseXml });
  const repeatUntil = buildRepeatUntilBlock('lembot_on_goal', ifBlock, nextId, { x: 24, y: 24 });
  return wrapXml(repeatUntil);
};

const buildLevel03Solution = () => {
  const nextId = createIdFactory('level-03');
  const shiftRight = buildActionBlocks(
    ['TURN_RIGHT', 'MOVE_FORWARD', 'MOVE_FORWARD', 'MOVE_FORWARD', 'TURN_LEFT'],
    nextId,
  );
  const shiftLeft = buildActionBlocks(
    ['TURN_LEFT', 'MOVE_FORWARD', 'MOVE_FORWARD', 'MOVE_FORWARD', 'TURN_RIGHT'],
    nextId,
  );
  const advance = buildActionBlocks(['MOVE_FORWARD'], nextId);
  const rightIf = buildIfBlock('lembot_wall_right', shiftLeft, nextId, {
    elseBlockXml: advance,
  });
  const alignIf = buildIfBlock('lembot_wall_left', shiftRight, nextId, {
    elseBlockXml: rightIf,
    position: { x: 24, y: 24 },
  });
  const routeMoves = buildRepeatBlock(6, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  const routeTurn = buildActionBlocks(['TURN_RIGHT'], nextId);
  const routeAdvance = buildRepeatBlock(3, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  const routeExitTurn = buildActionBlocks(['TURN_LEFT'], nextId);
  const routeFinish = buildRepeatBlock(2, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  let routeBlocks = insertNext(routeMoves, routeTurn);
  routeBlocks = insertNext(routeBlocks, routeAdvance);
  routeBlocks = insertNext(routeBlocks, routeExitTurn);
  routeBlocks = insertNext(routeBlocks, routeFinish);
  return wrapXml(insertNext(alignIf, routeBlocks));
};

const buildLevel04Solution = () => {
  const nextId = createIdFactory('level-04');
  const turnRight = buildActionBlocks(['TURN_RIGHT'], nextId, { x: 24, y: 24 });
  const stride = buildRepeatBlock(6, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  const turnLeft = buildActionBlocks(['TURN_LEFT'], nextId);
  const hallway = buildRepeatBlock(4, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  const turnLeftAgain = buildActionBlocks(['TURN_LEFT'], nextId);
  const moveForward = buildActionBlocks(['MOVE_FORWARD'], nextId);
  const turnRightAgain = buildActionBlocks(['TURN_RIGHT'], nextId);
  const finalStride = buildRepeatBlock(2, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  const finalTurn = buildActionBlocks(['TURN_RIGHT'], nextId);
  const finalMove = buildActionBlocks(['MOVE_FORWARD'], nextId);
  let chain = insertNext(turnRight, stride);
  chain = insertNext(chain, turnLeft);
  chain = insertNext(chain, hallway);
  chain = insertNext(chain, turnLeftAgain);
  chain = insertNext(chain, moveForward);
  chain = insertNext(chain, turnRightAgain);
  chain = insertNext(chain, finalStride);
  chain = insertNext(chain, finalTurn);
  chain = insertNext(chain, finalMove);
  return wrapXml(chain);
};

const buildLevel05Solution = () => {
  const nextId = createIdFactory('level-05');
  const turnRight = buildActionBlocks(['TURN_RIGHT'], nextId, { x: 24, y: 24 });
  const stride = buildRepeatBlock(6, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  const turnLeft = buildActionBlocks(['TURN_LEFT'], nextId);
  const finish = buildRepeatBlock(6, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  let chain = insertNext(turnRight, stride);
  chain = insertNext(chain, turnLeft);
  chain = insertNext(chain, finish);
  return wrapXml(chain);
};

const buildLevel06Solution = () => {
  const nextId = createIdFactory('level-06');
  const stride = buildRepeatBlock(6, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId, {
    x: 24,
    y: 24,
  });
  const turnRight = buildActionBlocks(['TURN_RIGHT'], nextId);
  const finish = buildRepeatBlock(6, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  let chain = insertNext(stride, turnRight);
  chain = insertNext(chain, finish);
  return wrapXml(chain);
};

const buildLevel07Solution = () => {
  const nextId = createIdFactory('level-07');
  const spinAround = buildRepeatBlock(2, buildActionBlocks(['TURN_LEFT'], nextId), nextId, {
    x: 24,
    y: 24,
  });
  const firstStride = buildRepeatBlock(2, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  const turnLeft = buildActionBlocks(['TURN_LEFT'], nextId);
  const longStride = buildRepeatBlock(3, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  const turnLeftAgain = buildActionBlocks(['TURN_LEFT'], nextId);
  const shortStride = buildRepeatBlock(2, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  const turnRight = buildActionBlocks(['TURN_RIGHT'], nextId);
  const nextStride = buildRepeatBlock(3, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  const turnLeftFinal = buildActionBlocks(['TURN_LEFT'], nextId);
  const finalHall = buildRepeatBlock(7, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  const finalTurn = buildActionBlocks(['TURN_RIGHT'], nextId);
  const lastStep = buildActionBlocks(['MOVE_FORWARD'], nextId);
  let chain = insertNext(spinAround, firstStride);
  chain = insertNext(chain, turnLeft);
  chain = insertNext(chain, longStride);
  chain = insertNext(chain, turnLeftAgain);
  chain = insertNext(chain, shortStride);
  chain = insertNext(chain, turnRight);
  chain = insertNext(chain, nextStride);
  chain = insertNext(chain, turnLeftFinal);
  chain = insertNext(chain, finalHall);
  chain = insertNext(chain, finalTurn);
  chain = insertNext(chain, lastStep);
  return wrapXml(chain);
};

const buildLevel08Solution = () => {
  const nextId = createIdFactory('level-08');
  const stride = buildRepeatBlock(6, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId, {
    x: 24,
    y: 24,
  });
  const turnRight = buildActionBlocks(['TURN_RIGHT'], nextId);
  const finish = buildRepeatBlock(6, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  let chain = insertNext(stride, turnRight);
  chain = insertNext(chain, finish);
  return wrapXml(chain);
};

const buildLevel09Solution = () => {
  const nextId = createIdFactory('level-09');
  const stride = buildRepeatBlock(6, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId, {
    x: 24,
    y: 24,
  });
  const turnRight = buildActionBlocks(['TURN_RIGHT'], nextId);
  const finish = buildRepeatBlock(6, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  let chain = insertNext(stride, turnRight);
  chain = insertNext(chain, finish);
  return wrapXml(chain);
};

const buildLevel10Solution = () => {
  const nextId = createIdFactory('level-10');
  const stride = buildRepeatBlock(6, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId, {
    x: 24,
    y: 24,
  });
  const turnRight = buildActionBlocks(['TURN_RIGHT'], nextId);
  const finish = buildRepeatBlock(6, buildActionBlocks(['MOVE_FORWARD'], nextId), nextId);
  let chain = insertNext(stride, turnRight);
  chain = insertNext(chain, finish);
  return wrapXml(chain);
};

export const levelSolutionXmlById: Record<string, string> = {
  'level-01': buildLevel01Solution(),
  'level-02': buildLevel02Solution(),
  'level-03': buildLevel03Solution(),
  'level-04': buildLevel04Solution(),
  'level-05': buildLevel05Solution(),
  'level-06': buildLevel06Solution(),
  'level-07': buildLevel07Solution(),
  'level-08': buildLevel08Solution(),
  'level-09': buildLevel09Solution(),
  'level-10': buildLevel10Solution(),
};
