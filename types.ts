
export enum Suit {
  Spade = '♠',
  Heart = '♥',
  Club = '♣',
  Diamond = '♦'
}

export enum Rank {
  Two = 2, Three, Four, Five, Six, Seven, Eight, Nine, Ten, Jack, Queen, King, Ace
}

export interface Card {
  suit: Suit;
  rank: Rank;
}

export enum HandType {
  HighCard = 0,    // 单张
  Pair = 1,        // 对子
  Straight = 2,    // 顺子
  Flush = 3,       // 金花
  StraightFlush = 4, // 顺金
  Trio = 5         // 豹子
}

export interface HandEvaluation {
  type: HandType;
  ranks: number[];
  score: number;
}

export enum PlayerType {
  Human = 'Human',
  AI = 'AI'
}

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  chips: number;
  hand: Card[];
  isSeen: boolean;
  isFolded: boolean;
  isWinner?: boolean;
}

export enum GameStage {
  Idle = 'Idle',
  Dealing = 'Dealing',
  Betting = 'Betting',
  Result = 'Result'
}

export enum Difficulty {
  Easy = 'Easy',
  Medium = 'Medium',
  Hard = 'Hard'
}

export enum ActionType {
  Call = '跟注',
  Raise = '加注',
  Compare = '比牌',
  Fold = '弃牌',
  AllIn = '梭哈',
  SeeCards = '看牌'
}

export interface GameLog {
  playerName: string;
  action: ActionType | string;
  amount?: number;
  timestamp: number;
}
