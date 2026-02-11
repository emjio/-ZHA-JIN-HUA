
import { Card, Suit, Rank } from '../types';

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  const suits = [Suit.Spade, Suit.Heart, Suit.Club, Suit.Diamond];
  const ranks = Object.values(Rank).filter(v => typeof v === 'number') as Rank[];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};
