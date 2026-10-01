export type Color = 0 | 1 | 2 | 3 | 4; // 0: Blue, 1: Yellow, 2: Red, 3: Black, 4: White
export const COLORS = ['Blue', 'Yellow', 'Red', 'Black', 'White'] as const;

export const FLOOR_PENALTIES = [-1, -1, -2, -2, -2, -3, -3] as const;
export const FACTORY_COUNTS: Record<number, number> = { 2: 5, 3: 7, 4: 9 };

export const WALL_LAYOUT: Color[][] = Array.from({ length: 5 }, (_, r) =>
  Array.from({ length: 5 }, (_, c) => ((c - r + 5) % 5) as Color)
);

export function getWallCol(row: number, color: Color): number {
  return (color + row) % 5;
}

export type FloorItem = Color | 'FIRST_PLAYER';

export interface PlayerBoard {
  id: string;
  name: string;
  score: number;
  patternLines: {
    color: Color | null;
    count: number;
    capacity: number;
  }[];
  wall: boolean[][];
  floor: FloorItem[];
}

export interface GameState {
  players: PlayerBoard[];
  factories: Color[][];
  center: Color[];
  hasFirstPlayerTokenInCenter: boolean;
  bag: Color[];
  lid: Color[];
  round: number;
  turnPlayerIndex: number;
  firstPlayerNextRoundIndex: number | null;
  phase: 'FACTORY_OFFER' | 'WALL_TILING' | 'CHECK_END' | 'GAME_OVER' | 'ENDGAME_BONUS';
}

export type DraftSource =
  | { type: 'FACTORY'; factoryIndex: number }
  | { type: 'CENTER' };

export interface DraftAction {
  source: DraftSource;
  color: Color;
  targetRow: number | null;
}

function createFreshBag(): Color[] {
  const bag: Color[] = [];
  for (let c = 0; c < 5; c++) {
    for (let i = 0; i < 20; i++) {
      bag.push(c as Color);
    }
  }
  return shuffle(bag);
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function initGame(playerConfigs: { id: string; name: string }[]): GameState {
  const numPlayers = playerConfigs.length;
  if (numPlayers < 2 || numPlayers > 4) {
    throw new Error('Azul strictly requires 2 to 4 players.');
  }

  const numFactories = FACTORY_COUNTS[numPlayers];
  let bag = createFreshBag();
  const lid: Color[] = [];

  const players: PlayerBoard[] = playerConfigs.map((p) => ({
    id: p.id,
    name: p.name,
    score: 0,
    patternLines: Array.from({ length: 5 }, (_, i) => ({
      color: null,
      count: 0,
      capacity: i + 1,
    })),
    wall: Array.from({ length: 5 }, () => Array(5).fill(false)),
    floor: [],
  }));

  const factories: Color[][] = [];
  for (let f = 0; f < numFactories; f++) {
    factories.push(bag.splice(0, 4));
  }

  return {
    players,
    factories,
    center: [],
    hasFirstPlayerTokenInCenter: true,
    bag,
    lid,
    round: 1,
    turnPlayerIndex: 0,
    firstPlayerNextRoundIndex: null,
    phase: 'FACTORY_OFFER',
  };
}

export function isValidPlacement(
  player: PlayerBoard,
  color: Color,
  targetRow: number | null
): { valid: boolean; reason?: string } {
  if (targetRow === null) {
    return { valid: true };
  }

  if (targetRow < 0 || targetRow > 4) {
    return { valid: false, reason: 'Invalid pattern line row index.' };
  }

  const line = player.patternLines[targetRow];

  // 1. Line is already full
  if (line.count >= line.capacity) {
    return { valid: false, reason: 'Target pattern line is already full.' };
  }

  // 2. Only block if the line has active tiles of a different color
  if (line.count > 0 && line.color !== null && line.color !== color) {
    return { valid: false, reason: 'Pattern line holds a different color.' };
  }

  // 3. Wall rule: Color must not already exist on that row of the wall
  const targetCol = getWallCol(targetRow, color);
  if (player.wall[targetRow][targetCol]) {
    return {
      valid: false,
      reason: `Color ${COLORS[color]} is already tiled on row ${targetRow + 1} of your wall.`,
    };
  }

  return { valid: true };
}

export function applyDraftAction(state: GameState, action: DraftAction): GameState {
  if (state.phase !== 'FACTORY_OFFER') {
    throw new Error('Actions can only be performed during FACTORY_OFFER phase.');
  }

  const nextState: GameState = JSON.parse(JSON.stringify(state));
  const player = nextState.players[nextState.turnPlayerIndex];

  const validation = isValidPlacement(player, action.color, action.targetRow);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  let draftedCount = 0;
  let tookFirstPlayerToken = false;

  if (action.source.type === 'FACTORY') {
    const fIdx = action.source.factoryIndex;
    const factory = nextState.factories[fIdx];
    if (!factory || factory.length === 0) {
      throw new Error('Selected factory is empty.');
    }

    const remainingTiles: Color[] = [];
    for (const tile of factory) {
      if (tile === action.color) {
        draftedCount++;
      } else {
        remainingTiles.push(tile);
      }
    }

    if (draftedCount === 0) {
      throw new Error(`Factory does not have color ${COLORS[action.color]}.`);
    }

    nextState.center.push(...remainingTiles);
    nextState.factories[fIdx] = [];
  } else {
    const matching: Color[] = [];
    const remaining: Color[] = [];

    for (const tile of nextState.center) {
      if (tile === action.color) {
        matching.push(tile);
      } else {
        remaining.push(tile);
      }
    }

    if (matching.length === 0) {
      throw new Error(`Center does not have color ${COLORS[action.color]}.`);
    }

    draftedCount = matching.length;
    nextState.center = remaining;

    if (nextState.hasFirstPlayerTokenInCenter) {
      tookFirstPlayerToken = true;
      nextState.hasFirstPlayerTokenInCenter = false;
      nextState.firstPlayerNextRoundIndex = nextState.turnPlayerIndex;
    }
  }

  // Handle first player token penalty slot
  if (tookFirstPlayerToken) {
    if (player.floor.length < 7) {
      player.floor.push('FIRST_PLAYER');
    }
  }

  // Place tiles into pattern line or dump to floor
  if (action.targetRow !== null) {
    const line = player.patternLines[action.targetRow];
    line.color = action.color;

    const availableSlots = line.capacity - line.count;
    const tilesToLine = Math.min(draftedCount, availableSlots);
    const overflowTiles = draftedCount - tilesToLine;

    line.count += tilesToLine;

    for (let i = 0; i < overflowTiles; i++) {
      if (player.floor.length < 7) {
        player.floor.push(action.color);
      } else {
        nextState.lid.push(action.color);
      }
    }
  } else {
    for (let i = 0; i < draftedCount; i++) {
      if (player.floor.length < 7) {
        player.floor.push(action.color);
      } else {
        nextState.lid.push(action.color);
      }
    }
  }

  const allFactoriesEmpty = nextState.factories.every((f) => f.length === 0);
  const centerEmpty = nextState.center.length === 0;

  if (allFactoriesEmpty && centerEmpty) {
    nextState.phase = 'WALL_TILING';
  } else {
    nextState.turnPlayerIndex = (nextState.turnPlayerIndex + 1) % nextState.players.length;
  }

  return nextState;
}

export function scoreTilePlacement(wall: boolean[][], r: number, c: number): number {
  let h = 1;
  for (let left = c - 1; left >= 0 && wall[r][left]; left--) h++;
  for (let right = c + 1; right < 5 && wall[r][right]; right++) h++;

  let v = 1;
  for (let up = r - 1; up >= 0 && wall[up][c]; up--) v++;
  for (let down = r + 1; down < 5 && wall[down][c]; down++) v++;

  if (h > 1 && v > 1) return h + v;
  if (h > 1) return h;
  if (v > 1) return v;
  return 1;
}

export function executeWallTiling(state: GameState): GameState {
  const nextState: GameState = JSON.parse(JSON.stringify(state));

  // Determine who took the first player token
  for (let pIdx = 0; pIdx < nextState.players.length; pIdx++) {
    if (nextState.players[pIdx].floor.includes('FIRST_PLAYER')) {
      nextState.firstPlayerNextRoundIndex = pIdx;
      break;
    }
  }

  for (const player of nextState.players) {
    let roundPoints = 0;

    for (let r = 0; r < 5; r++) {
      const line = player.patternLines[r];
      // Completed line: transfer 1 tile to wall, send the remaining (capacity - 1) to lid
      if (line.count === line.capacity && line.color !== null) {
        const c = getWallCol(r, line.color);

        player.wall[r][c] = true;
        roundPoints += scoreTilePlacement(player.wall, r, c);

        for (let i = 0; i < line.capacity - 1; i++) {
          nextState.lid.push(line.color);
        }

        // RESET completed line completely
        line.color = null;
        line.count = 0;
      }
      // If line is incomplete (line.count < line.capacity), leave intact per official rules
    }

    // Floor line penalties
    let floorPenalty = 0;
    for (let i = 0; i < player.floor.length; i++) {
      const item = player.floor[i];
      floorPenalty += Math.abs(FLOOR_PENALTIES[i]);
      if (item !== 'FIRST_PLAYER') {
        nextState.lid.push(item);
      }
    }

    player.score = Math.max(0, player.score + roundPoints - floorPenalty);
    // Explicitly empty the floor line
    player.floor = [];
  }

  // Check end game: any player with at least one completely filled horizontal row
  const hasCompletedRow = nextState.players.some((p) =>
    p.wall.some((row) => row.every((t) => t === true))
  );

  if (hasCompletedRow) {
    nextState.phase = 'ENDGAME_BONUS';
    return calculateEndgameBonuses(nextState);
  } else {
    return prepareNextRound(nextState);
  }
}

export function calculateEndgameBonuses(state: GameState): GameState {
  const nextState: GameState = JSON.parse(JSON.stringify(state));

  for (const player of nextState.players) {
    let bonus = 0;

    // +2 for each completed horizontal row
    for (let r = 0; r < 5; r++) {
      if (player.wall[r].every((t) => t === true)) bonus += 2;
    }

    // +7 for each completed vertical column
    for (let c = 0; c < 5; c++) {
      let colComplete = true;
      for (let r = 0; r < 5; r++) {
        if (!player.wall[r][c]) {
          colComplete = false;
          break;
        }
      }
      if (colComplete) bonus += 7;
    }

    // +10 for all 5 tiles of the same color
    for (let color = 0; color < 5; color++) {
      let allFivePlaced = true;
      for (let r = 0; r < 5; r++) {
        const c = getWallCol(r, color as Color);
        if (!player.wall[r][c]) {
          allFivePlaced = false;
          break;
        }
      }
      if (allFivePlaced) bonus += 10;
    }

    player.score += bonus;
  }

  nextState.phase = 'GAME_OVER';
  return nextState;
}

function prepareNextRound(state: GameState): GameState {
  const numPlayers = state.players.length;
  const numFactories = FACTORY_COUNTS[numPlayers];

  let bag = [...state.bag];
  let lid = [...state.lid];

  const neededTiles = numFactories * 4;
  if (bag.length < neededTiles) {
    bag = [...bag, ...shuffle(lid)];
    lid = [];
  }

  // Refill factories
  const factories: Color[][] = [];
  for (let f = 0; f < numFactories; f++) {
    const batch = bag.splice(0, 4);
    // If bag still has less than 4 even after refill, draw whatever is left
    factories.push(batch);
  }

  // Next round starting player (whoever held the First Player token in their floor line)
  const nextStartPlayer =
    state.firstPlayerNextRoundIndex !== null
      ? state.firstPlayerNextRoundIndex
      : (state.turnPlayerIndex + 1) % state.players.length;

  return {
    ...state,
    bag,
    lid,
    factories,
    center: [], // Force empty center
    hasFirstPlayerTokenInCenter: true, // 1st player marker returns to center
    round: state.round + 1,
    turnPlayerIndex: nextStartPlayer,
    firstPlayerNextRoundIndex: null,
    phase: 'FACTORY_OFFER',
  };
}