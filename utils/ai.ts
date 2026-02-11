
import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, ActionType, HandEvaluation, Card, Player } from '../types';

const aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface AIDecision {
  action: ActionType;
  raiseAmount?: number;
  thought?: string;
}

export const getGeminiAIDecision = async (
  difficulty: Difficulty,
  aiPlayer: Player,
  allPlayers: Player[],
  currentPot: number,
  currentBet: number,
  handEval: HandEvaluation,
  roundCount: number,
  ante: number,
  maxPot: number
): Promise<AIDecision> => {
  try {
    const modelName = difficulty === Difficulty.Hard ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    
    // Filter active opponents
    const activeOpponents = allPlayers.filter(p => p.id !== aiPlayer.id && !p.isFolded);
    const opponentInfo = activeOpponents.map(p => 
      `${p.name}: ${p.chips} chips, ${p.isSeen ? 'SEEN cards (paying double)' : 'BLIND betting (paying 1x)'}`
    ).join('\n');

    // Strategic constraint: If betting blind, do NOT reveal the hand to Gemini.
    const handStatus = aiPlayer.isSeen 
      ? `Your Cards: ${JSON.stringify(aiPlayer.hand)}
         Hand Type: ${handEval.type}
         Strength Score: ${handEval.score}/100 (Where 0 is 2-high and 100 is AAA Trio)`
      : `Your Cards: UNKNOWN. You are betting BLIND (闷牌). 
         Tactical Tip: Betting blind is cheaper (1x cost) and puts psychological pressure on SEEN players.`;

    const prompt = `
      You are a world-class professional player of "Zha Jin Hua" (Golden Flower).
      Your goal is to dominate the table and win as many chips as possible.

      Game Rules Context:
      - Round: ${roundCount} / 5
      - Pot: ${currentPot} (Limit: ${maxPot})
      - Current Base Bet Unit: ${currentBet}
      - Ante: ${ante}

      Your Status (${aiPlayer.name}):
      - Chips: ${aiPlayer.chips}
      - Status: ${aiPlayer.isSeen ? 'SEEN (Costs 2x base unit to play)' : 'BLIND (Costs 1x base unit to play)'}
      - ${handStatus}

      Opponents (${activeOpponents.length} players left):
      ${opponentInfo}

      Zha Jin Hua Strategy Guide:
      1. Blind Pressure (闷牌): In early rounds (1-3), staying blind is often better unless someone raises heavily. It keeps your costs low and forces "Seen" players to pay double to stay in.
      2. The "Look" (看牌): Peeking gives you information but doubles your costs. If you look and find a weak hand (Score < 30), consider folding immediately.
      3. Bluffing: If you are "Seen" but have a weak hand, you might "Raise" to pretend you have a Trio/Flush, especially against other "Seen" players.
      4. Comparison (比牌): Use this to eliminate players when you are confident or want to end the round.

      Difficulty: ${difficulty}
      Decision: Choose your action.
    `;

    const response = await aiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: {
              type: Type.STRING,
              enum: ['跟注', '加注', '比牌', '弃牌', '梭哈', '看牌'],
              description: 'The tactical action to take.'
            },
            raiseAmount: {
              type: Type.NUMBER,
              description: 'Amount to increment if raising (usually equal to ante).'
            },
            thought: {
              type: Type.STRING,
              description: 'Your internal professional reasoning. Analyze pot odds and opponent psychology.'
            }
          },
          required: ['action', 'thought']
        }
      }
    });

    const result = JSON.parse(response.text);
    return {
      action: result.action as ActionType,
      raiseAmount: result.raiseAmount || ante,
      thought: result.thought
    };
  } catch (error) {
    console.error("Gemini AI Decision Error:", error);
    // Fallback: If error, just call to keep the game moving.
    return { action: ActionType.Call, thought: "Error fallback: Calling to stay in." };
  }
};
