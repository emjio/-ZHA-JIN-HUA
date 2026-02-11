
import { Card, Rank, HandType, HandEvaluation } from '../types';

export const getHandEvaluation = (cards: Card[]): HandEvaluation => {
  if (cards.length !== 3) return { type: HandType.HighCard, ranks: [], score: 0 };

  const sortedCards = [...cards].sort((a, b) => b.rank - a.rank);
  // Fix: Explicitly type ranks as number[] to allow non-enum values like 1 for special straight handling
  const ranks: number[] = sortedCards.map(c => c.rank);
  const suits = sortedCards.map(c => c.suit);

  const isFlush = suits[0] === suits[1] && suits[1] === suits[2];
  
  // Straight logic (A-K-Q or A-2-3)
  let isStraight = false;
  // Fix: Explicitly type straightRanks as number[]
  let straightRanks: number[] = [...ranks];
  if (ranks[0] === Rank.Ace && ranks[1] === Rank.Three && ranks[2] === Rank.Two) {
    isStraight = true;
    straightRanks = [Rank.Three, Rank.Two, 1]; // Special handling for A-2-3
  } else if (ranks[0] === ranks[1] + 1 && ranks[1] === ranks[2] + 1) {
    isStraight = true;
  }

  const isTrio = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  const isPair = ranks[0] === ranks[1] || ranks[1] === ranks[2] || ranks[0] === ranks[2];

  let type: HandType = HandType.HighCard;
  let compareRanks: number[] = ranks;

  if (isTrio) {
    type = HandType.Trio;
    compareRanks = [ranks[0]];
  } else if (isFlush && isStraight) {
    type = HandType.StraightFlush;
    compareRanks = straightRanks;
  } else if (isFlush) {
    type = HandType.Flush;
    compareRanks = ranks;
  } else if (isStraight) {
    type = HandType.Straight;
    compareRanks = straightRanks;
  } else if (isPair) {
    type = HandType.Pair;
    const pairRank = ranks[0] === ranks[1] ? ranks[0] : ranks[1];
    const kicker = ranks[0] === ranks[1] ? ranks[2] : ranks[0];
    compareRanks = [pairRank, kicker];
  }

  // AI Scoring (0-100) based on requirements
  let score = 0;
  switch (type) {
    case HandType.Trio:
      score = 85 + (ranks[0] - 2);
      if (ranks[0] === Rank.Ace) score = 100;
      break;
    case HandType.StraightFlush:
      score = 75 + (straightRanks[0] - 3);
      if (straightRanks[0] === Rank.Ace) score = 84;
      break;
    case HandType.Flush:
      score = 65 + (ranks[0] - 2) * 0.7;
      break;
    case HandType.Straight:
      score = 55 + (straightRanks[0] - 3);
      break;
    case HandType.Pair:
      score = 40 + (compareRanks[0] - 2);
      break;
    case HandType.HighCard:
      score = (ranks[0] - 2) * 2;
      break;
  }

  return { type, ranks: compareRanks, score: Math.min(100, Math.floor(score)) };
};

export const compareHands = (h1: HandEvaluation, h2: HandEvaluation): number => {
  if (h1.type !== h2.type) return h1.type - h2.type;
  for (let i = 0; i < Math.max(h1.ranks.length, h2.ranks.length); i++) {
    if (h1.ranks[i] !== h2.ranks[i]) return h1.ranks[i] - h2.ranks[i];
  }
  return 0;
};

export const getHandName = (type: HandType): string => {
  switch (type) {
    case HandType.Trio: return '豹子';
    case HandType.StraightFlush: return '顺金';
    case HandType.Flush: return '金花';
    case HandType.Straight: return '顺子';
    case HandType.Pair: return '对子';
    case HandType.HighCard: return '单张';
    default: return '未知';
  }
};
