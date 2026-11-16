export type ControlMode = 'camera' | 'mouse';
export type GameMode = 'arcade' | 'daily';

export type GameSettings = {
  mirror: boolean;
  showVideo: boolean;
  showLandmarks: boolean;
  showTrail: boolean;
  sound: boolean;
  reducedEffects: boolean;
};

export type GameSnapshot = {
  score: number;
  lives: number;
  combo: number;
  maxCombo: number;
  fruitHits: number;
  swings: number;
  misses: number;
  bombs: number;
  elapsed: number;
};

export type GameResult = GameSnapshot & {
  accuracy: number;
  mode: ControlMode;
  gameMode: GameMode;
  createdAt: string;
};

export type LeaderboardEntry = GameResult & {
  id: string;
  name: string;
};

export type Point = { x: number; y: number };

export const INITIAL_SNAPSHOT: GameSnapshot = {
  score: 0,
  lives: 5,
  combo: 1,
  maxCombo: 1,
  fruitHits: 0,
  swings: 0,
  misses: 0,
  bombs: 0,
  elapsed: 0,
};

export const DEFAULT_SETTINGS: GameSettings = {
  mirror: true,
  showVideo: true,
  showLandmarks: true,
  showTrail: true,
  sound: true,
  reducedEffects: false,
};
