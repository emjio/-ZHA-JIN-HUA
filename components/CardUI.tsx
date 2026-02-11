
import React from 'react';
import { Card, Suit } from '../types';

interface CardUIProps {
  card?: Card;
  hidden?: boolean;
  className?: string;
}

const CardUI: React.FC<CardUIProps> = ({ card, hidden, className = '' }) => {
  if (hidden || !card) {
    return (
      <div className={`w-16 h-24 md:w-20 md:h-32 bg-blue-800 rounded-lg border-2 border-white flex items-center justify-center card-shadow transition-transform hover:-translate-y-2 ${className}`}>
        <div className="w-12 h-20 md:w-16 md:h-28 border border-blue-600 rounded flex items-center justify-center">
            <div className="text-white opacity-20 text-3xl font-bold italic">?</div>
        </div>
      </div>
    );
  }

  const isRed = card.suit === Suit.Heart || card.suit === Suit.Diamond;
  const rankDisplay = (r: number) => {
    if (r === 14) return 'A';
    if (r === 13) return 'K';
    if (r === 12) return 'Q';
    if (r === 11) return 'J';
    return r.toString();
  };

  return (
    <div className={`w-16 h-24 md:w-20 md:h-32 bg-white rounded-lg border border-gray-300 flex flex-col p-1 md:p-2 card-shadow transition-transform hover:-translate-y-2 ${className}`}>
      <div className={`text-lg md:text-xl font-bold ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        {rankDisplay(card.rank)}
      </div>
      <div className={`text-2xl md:text-3xl flex-grow flex items-center justify-center ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        {card.suit}
      </div>
      <div className={`text-lg md:text-xl font-bold self-end rotate-180 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        {rankDisplay(card.rank)}
      </div>
    </div>
  );
};

export default CardUI;
