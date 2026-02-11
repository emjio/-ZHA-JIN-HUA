
import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, PlayerType, Player, GameStage, Difficulty, 
  ActionType, GameLog, HandEvaluation 
} from './types';
import { createDeck, shuffleDeck } from './utils/deck';
import { getHandEvaluation, compareHands, getHandName } from './utils/evaluator';
import { getGeminiAIDecision } from './utils/ai';
import CardUI from './components/CardUI';

const INITIAL_CHIPS = 1000;
const ANTE = 10;
const MAX_ROUNDS = 5;
const MAX_POT = 1000;

const App: React.FC = () => {
  // Config States
  const [numAIs, setNumAIs] = useState(3);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Medium);
  
  // Game States
  const [players, setPlayers] = useState<Player[]>([
    { id: 'human', name: '您', type: PlayerType.Human, chips: INITIAL_CHIPS, hand: [], isSeen: false, isFolded: false }
  ]);
  const [pot, setPot] = useState(0);
  const [currentBet, setCurrentBet] = useState(ANTE);
  const [stage, setStage] = useState<GameStage>(GameStage.Idle);
  const [activeIdx, setActiveIdx] = useState(0);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [roundCount, setRoundCount] = useState(0);
  const [gameMessage, setGameMessage] = useState('设置人数并点击开始对决！');
  const [isAiThinking, setIsAiThinking] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (playerName: string, action: ActionType | string, amount?: number) => {
    setLogs(prev => [...prev, { playerName, action, amount, timestamp: Date.now() }]);
  };

  const initPlayers = () => {
    const p: Player[] = [
      { id: 'human', name: '您', type: PlayerType.Human, chips: INITIAL_CHIPS, hand: [], isSeen: false, isFolded: false }
    ];
    for (let i = 1; i <= numAIs; i++) {
      p.push({ id: `ai-${i}`, name: `AI ${i}`, type: PlayerType.AI, chips: INITIAL_CHIPS, hand: [], isSeen: false, isFolded: false });
    }
    setPlayers(p);
  };

  useEffect(() => {
    if (stage === GameStage.Idle) initPlayers();
  }, [numAIs, stage]);

  const startNewGame = () => {
    const activePlayers = players.filter(p => p.chips >= ANTE);
    if (activePlayers.length < 2) {
      alert('至少需要两名有筹码的玩家才能开始！');
      return;
    }

    const deck = shuffleDeck(createDeck());
    let deckIdx = 0;

    const newPlayers = players.map(p => {
      if (p.chips < ANTE) return { ...p, isFolded: true };
      const hand = [deck[deckIdx++], deck[deckIdx++], deck[deckIdx++]];
      return { ...p, hand, isSeen: false, isFolded: false, isWinner: false, chips: p.chips - ANTE };
    });

    setPlayers(newPlayers);
    const initialPot = newPlayers.filter(p => !p.isFolded).length * ANTE;
    setPot(initialPot);
    setCurrentBet(ANTE);
    setStage(GameStage.Betting);
    setActiveIdx(0); 
    setRoundCount(1);
    setLogs([]);
    setGameMessage('发牌完成，请先行操作。');
    newPlayers.filter(p => !p.isFolded).forEach(p => addLog(p.name, '缴纳底注', ANTE));
  };

  const nextTurn = (currentIdx: number, currentPlayers: Player[], currentPot: number) => {
    if (currentPlayers.length === 0) return;

    if (currentPot >= MAX_POT) {
      addLog('系统', '奖池封顶，强制开牌');
      setGameMessage('奖池已达封顶(1000)，触发全场强制比牌！');
      finishGame(currentPlayers, undefined, currentPot);
      return;
    }

    let next = (currentIdx + 1) % currentPlayers.length;
    let safety = 0;
    
    while (
      (currentPlayers[next].isFolded || currentPlayers[next].chips < 0) && 
      safety < currentPlayers.length
    ) {
      next = (next + 1) % currentPlayers.length;
      safety++;
    }

    const activeCount = currentPlayers.filter(p => !p.isFolded).length;
    if (activeCount <= 1) {
      finishGame(currentPlayers, undefined, currentPot);
      return;
    }

    if (next === 0) {
      if (roundCount >= MAX_ROUNDS) {
        finishGame(currentPlayers, undefined, currentPot);
        return;
      }
      setRoundCount(prev => prev + 1);
    }
    setActiveIdx(next);
  };

  const handleFold = (idx: number) => {
    const updated = [...players];
    updated[idx].isFolded = true;
    setPlayers(updated);
    addLog(updated[idx].name, ActionType.Fold);
    
    const remaining = updated.filter(p => !p.isFolded);
    if (remaining.length === 1) {
      finishGame(updated, remaining[0].id, pot);
    } else {
      nextTurn(idx, updated, pot);
    }
  };

  const handleSeeCards = (idx: number) => {
    const updated = [...players];
    updated[idx].isSeen = true;
    setPlayers(updated);
    addLog(updated[idx].name, ActionType.SeeCards);
    if (idx === 0) setGameMessage('已看牌，下注金额翻倍。');
  };

  const handleCall = (idx: number) => {
    const p = players[idx];
    const cost = currentBet * (p.isSeen ? 2 : 1);
    
    const updated = [...players];
    let newPot = pot;
    if (p.chips < cost) {
      const amount = updated[idx].chips;
      updated[idx].chips = 0;
      newPot += amount;
      addLog(p.name, ActionType.AllIn, amount);
    } else {
      updated[idx].chips -= cost;
      newPot += cost;
      addLog(p.name, ActionType.Call, cost);
    }
    
    setPot(newPot);
    setPlayers(updated);
    nextTurn(idx, updated, newPot);
  };

  const handleRaise = (idx: number, increment: number) => {
    const p = players[idx];
    const newBlindUnit = currentBet + increment;
    const cost = newBlindUnit * (p.isSeen ? 2 : 1);

    if (p.chips < cost) return;

    const updated = [...players];
    updated[idx].chips -= cost;
    const newPot = pot + cost;
    setPot(newPot);
    setPlayers(updated);
    setCurrentBet(newBlindUnit);
    addLog(p.name, ActionType.Raise, cost);
    nextTurn(idx, updated, newPot);
  };

  const handleAllIn = (idx: number) => {
    const p = players[idx];
    const amount = p.chips;
    const updated = [...players];
    updated[idx].chips = 0;
    const newPot = pot + amount;
    setPot(newPot);
    setPlayers(updated);
    addLog(p.name, ActionType.AllIn, amount);
    nextTurn(idx, updated, newPot);
  };

  const handleCompare = (idx: number) => {
    const p = players[idx];
    const cost = currentBet * (p.isSeen ? 2 : 1);
    if (p.chips < cost) return;

    let targetIdx = (idx + 1) % players.length;
    while (players[targetIdx].isFolded && targetIdx !== idx) {
      targetIdx = (targetIdx + 1) % players.length;
    }

    if (targetIdx === idx) return;

    const updated = [...players];
    updated[idx].chips -= cost;
    const newPot = pot + cost;
    setPot(newPot);
    
    const h1 = getHandEvaluation(p.hand);
    const h2 = getHandEvaluation(players[targetIdx].hand);
    const result = compareHands(h1, h2);

    addLog(p.name, `发起比牌 (VS ${players[targetIdx].name})`, cost);

    if (result > 0) {
      updated[targetIdx].isFolded = true;
      setGameMessage(`${p.name} 胜过 ${players[targetIdx].name}`);
    } else {
      updated[idx].isFolded = true;
      setGameMessage(`${p.name} 输给 ${players[targetIdx].name}，被迫弃牌`);
    }

    setPlayers(updated);
    
    const remaining = updated.filter(p => !p.isFolded);
    if (remaining.length === 1) {
      finishGame(updated, remaining[0].id, newPot);
    } else {
      nextTurn(idx, updated, newPot);
    }
  };

  const finishGame = (currentPlayers: Player[], winnerId?: string, finalPot?: number) => {
    setStage(GameStage.Result);
    const updated = [...currentPlayers];
    const targetPot = finalPot !== undefined ? finalPot : pot;
    let actualWinnerIdx = -1;

    if (winnerId) {
      actualWinnerIdx = updated.findIndex(p => p.id === winnerId);
    } else {
      const remaining = updated.filter(p => !p.isFolded);
      let bestIdx = -1;
      let bestEval: HandEvaluation | null = null;

      remaining.forEach(p => {
        const ev = getHandEvaluation(p.hand);
        const idx = updated.findIndex(u => u.id === p.id);
        if (!bestEval || compareHands(ev, bestEval) > 0) {
          bestEval = ev;
          bestIdx = idx;
        }
      });
      actualWinnerIdx = bestIdx;
    }

    if (actualWinnerIdx !== -1 && actualWinnerIdx < updated.length) {
      updated[actualWinnerIdx].chips += targetPot;
      updated[actualWinnerIdx].isWinner = true;
      setGameMessage(`游戏结束！${updated[actualWinnerIdx].name} 赢得了奖池 🪙${targetPot}`);
    } else {
       setGameMessage(`对局结束，无明确胜者。`);
    }
    setPlayers(updated);
    setPot(0);
  };

  // Gemini AI Logic
  useEffect(() => {
    if (stage === GameStage.Betting && players[activeIdx]?.type === PlayerType.AI && !players[activeIdx].isFolded) {
      setIsAiThinking(true);
      
      const processAiTurn = async () => {
        const ai = players[activeIdx];
        if (!ai || ai.isFolded) return;

        const aiEval = getHandEvaluation(ai.hand);

        // Pass all players to AI for table context
        const decision = await getGeminiAIDecision(
          difficulty,
          ai,
          players,
          pot,
          currentBet,
          aiEval,
          roundCount,
          ANTE,
          MAX_POT
        );
        
        setTimeout(() => {
          setIsAiThinking(false);
          
          switch (decision.action) {
            case ActionType.SeeCards: handleSeeCards(activeIdx); break;
            case ActionType.Fold: handleFold(activeIdx); break;
            case ActionType.Call: handleCall(activeIdx); break;
            case ActionType.Raise: handleRaise(activeIdx, ANTE); break;
            case ActionType.Compare: handleCompare(activeIdx); break;
            case ActionType.AllIn: handleAllIn(activeIdx); break;
            default: handleCall(activeIdx);
          }
        }, 1200);
      };

      processAiTurn();
    }
  }, [activeIdx, stage]);

  return (
    <div className="h-screen w-screen flex flex-col poker-table overflow-hidden">
      {/* Top Bar */}
      <header className="bg-black/60 p-3 flex justify-between items-center border-b border-green-800 backdrop-blur-sm z-20">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-yellow-500 tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full"></span>
            黄金花 ZHA JIN HUA
          </h1>
          <div className="flex gap-4 items-center bg-black/40 px-3 py-1 rounded-lg">
            <label className="text-xs text-gray-400 font-bold">对手人数</label>
            <input 
              type="range" min="1" max="5" value={numAIs} 
              onChange={(e) => setNumAIs(parseInt(e.target.value))}
              disabled={stage !== GameStage.Idle}
              className="w-24 accent-yellow-500"
            />
            <span className="text-yellow-400 font-bold">{numAIs}</span>
          </div>
          <div className="flex gap-4 items-center bg-black/40 px-3 py-1 rounded-lg">
            <label className="text-xs text-gray-400 font-bold">AI 模型</label>
            <select 
              value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              disabled={stage !== GameStage.Idle}
              className="bg-transparent text-yellow-400 font-bold outline-none cursor-pointer"
            >
              <option value={Difficulty.Easy}>Gemini Flash (初级)</option>
              <option value={Difficulty.Medium}>Gemini Flash (中级)</option>
              <option value={Difficulty.Hard}>Gemini Pro (高级)</option>
            </select>
          </div>
        </div>
        <div className="text-center relative">
            <div className="text-[10px] uppercase text-gray-400 font-bold tracking-[0.2em]">POT</div>
            <div className={`text-2xl font-bold tabular-nums transition-colors ${pot >= 800 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>🪙 {pot}</div>
            {pot >= 1000 && <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-red-400 font-black animate-bounce">LIMIT!</div>}
        </div>
        <button 
          onClick={() => setStage(GameStage.Idle)}
          className="text-gray-400 text-sm hover:text-white transition-colors"
        >
          重置局面
        </button>
      </header>

      {/* Opponents Area */}
      <main className="flex-grow relative flex flex-col p-4">
        {/* AI Players Grid */}
        <div className="flex-1 flex flex-wrap justify-center content-start gap-6 pt-4 max-w-6xl mx-auto">
          {players.slice(1).map((p, i) => (
            <div key={p.id} className={`flex flex-col items-center transition-all duration-300 ${p.isFolded ? 'opacity-40 scale-90' : 'opacity-100'}`}>
              <div className={`p-2 rounded-xl transition-all relative ${activeIdx === i + 1 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'bg-black/20'}`}>
                <div className="text-center mb-2">
                  <div className={`text-xs font-bold uppercase ${p.isFolded ? 'text-red-400' : 'text-gray-200'}`}>
                    {p.name} {p.isWinner && '👑'} {p.isFolded && '(已弃牌)'}
                  </div>
                  <div className="text-sm font-bold text-blue-300 tabular-nums">💰 {p.chips}</div>
                </div>
                <div className="flex gap-1 justify-center">
                  {[0, 1, 2].map(k => (
                    <CardUI key={k} card={p.hand?.[k]} hidden={stage !== GameStage.Result} className="scale-75 md:scale-90" />
                  ))}
                </div>
                {p.isSeen && !p.isFolded && (
                  <div className="mt-1 text-[10px] text-center text-yellow-400 font-black tracking-tighter uppercase italic">Looked</div>
                )}
                {activeIdx === i + 1 && isAiThinking && (
                   <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] px-2 py-1 rounded-md animate-bounce whitespace-nowrap z-50">
                     Gemini 策略中...
                   </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Center Game UI */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center z-10 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md px-10 py-6 rounded-3xl border border-yellow-600/50 inline-block shadow-2xl pointer-events-auto max-w-lg">
             <div className="text-sm text-yellow-500/80 mb-1 font-bold tracking-widest uppercase">
               第 {roundCount} / {MAX_ROUNDS} 轮
             </div>
             <p className="text-xl font-bold text-white drop-shadow-lg">{gameMessage}</p>

             {stage === GameStage.Idle && (
               <button onClick={startNewGame} className="mt-4 bg-green-600 hover:bg-green-500 text-white px-10 py-3 rounded-full font-bold shadow-xl transition-all transform active:scale-95">开始发牌</button>
             )}
             {stage === GameStage.Result && (
               <button onClick={startNewGame} className="mt-4 bg-yellow-600 hover:bg-yellow-500 text-white px-10 py-3 rounded-full font-bold shadow-xl transition-all transform active:scale-95">再来一局</button>
             )}
          </div>
        </div>

        {/* Human Section */}
        <div className="h-48 md:h-64 flex flex-col items-center justify-center bg-black/20 rounded-t-[100px] border-t border-white/5 backdrop-blur-sm">
          <div className={`relative transition-all ${activeIdx === 0 ? 'scale-110' : 'scale-100'}`}>
            <div className="flex gap-3 justify-center mb-4">
              {players[0]?.hand?.map((c, i) => (
                <CardUI key={i} card={c} hidden={!players[0].isSeen} className={players[0].isFolded ? 'grayscale opacity-50' : ''} />
              ))}
            </div>
            {activeIdx === 0 && !players[0]?.isFolded && stage === GameStage.Betting && (
              <div className="absolute -top-4 -right-4 w-8 h-8 bg-yellow-400 rounded-full animate-ping opacity-75"></div>
            )}
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-black text-green-400 drop-shadow-md">💰 {players[0]?.chips}</span>
              <div className="px-4 py-1 bg-green-900/40 rounded-full border border-green-500/50 text-white font-bold text-sm">
                您的席位 {players[0]?.isWinner && '👑'} {players[0]?.isFolded && '(已弃牌)'}
              </div>
            </div>
            {players[0]?.isSeen && !players[0]?.isFolded && stage !== GameStage.Idle && players[0].hand.length === 3 && (
              <div className="text-yellow-400 font-bold mt-1 text-sm">
                牌型: {getHandName(getHandEvaluation(players[0].hand).type)}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Control Panel */}
      <footer className="bg-slate-900 border-t border-slate-800 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-4xl mx-auto grid grid-cols-5 gap-3">
          <button 
            disabled={stage !== GameStage.Betting || activeIdx !== 0 || players[0]?.isSeen}
            onClick={() => handleSeeCards(0)}
            className={`py-3 rounded-xl font-bold transition-all ${stage === GameStage.Betting && activeIdx === 0 && !players[0]?.isSeen ? 'bg-indigo-600 hover:bg-indigo-500 shadow-lg text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
          >看牌</button>
          
          <button 
            disabled={stage !== GameStage.Betting || activeIdx !== 0}
            onClick={() => handleCall(0)}
            className={`py-3 rounded-xl font-bold transition-all ${stage === GameStage.Betting && activeIdx === 0 ? 'bg-blue-600 hover:bg-blue-500 shadow-lg text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
          >跟注 ({currentBet * (players[0]?.isSeen ? 2 : 1)})</button>
          
          <button 
            disabled={stage !== GameStage.Betting || activeIdx !== 0}
            onClick={() => handleRaise(0, ANTE)}
            className={`py-3 rounded-xl font-bold transition-all ${stage === GameStage.Betting && activeIdx === 0 ? 'bg-yellow-600 hover:bg-yellow-500 shadow-lg text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
          >加注 (+{ANTE * (players[0]?.isSeen ? 2 : 1)})</button>
          
          <button 
            disabled={stage !== GameStage.Betting || activeIdx !== 0}
            onClick={() => handleCompare(0)}
            className={`py-3 rounded-xl font-bold transition-all ${stage === GameStage.Betting && activeIdx === 0 ? 'bg-purple-600 hover:bg-purple-500 shadow-lg text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
          >比牌 ({currentBet * (players[0]?.isSeen ? 2 : 1)})</button>
          
          <button 
            disabled={stage !== GameStage.Betting || activeIdx !== 0}
            onClick={() => handleFold(0)}
            className={`py-3 rounded-xl font-bold transition-all ${stage === GameStage.Betting && activeIdx === 0 ? 'bg-red-600 hover:bg-red-500 shadow-lg text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
          >弃牌</button>
        </div>
        
        {/* Bottom Info */}
        <div className="mt-3 flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2">
            <div>闷牌基数: {currentBet} | 奖池上限: 1000</div>
            <div>规则: 看牌需付双倍 | 接入 Gemini AI 实时博弈</div>
            <div className="text-yellow-500/50">Powered by Gemini AI Engine</div>
        </div>
      </footer>

      {/* Side Logs */}
      <div className="fixed right-6 top-24 w-64 max-h-[400px] bg-black/40 backdrop-blur-md rounded-2xl border border-white/5 flex flex-col overflow-hidden hidden xl:flex shadow-2xl">
          <div className="bg-white/5 px-4 py-2 text-xs font-black text-slate-400 uppercase tracking-tighter">对局记录</div>
          <div className="flex-grow overflow-y-auto p-3 space-y-2 text-[11px]">
              {logs.map((log, i) => (
                  <div key={i} className="animate-in slide-in-from-right-2 duration-300">
                      <span className="text-yellow-500 font-bold">{log.playerName}:</span> 
                      <span className="text-slate-200 ml-1">{log.action}</span>
                      {log.amount && <span className="text-green-400 font-mono ml-1">🪙{log.amount}</span>}
                  </div>
              ))}
              <div ref={logEndRef} />
          </div>
      </div>
    </div>
  );
};

export default App;
