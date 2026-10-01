import { useState, useRef, useEffect } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Player } from './types';
import type { GameState, Color, DraftSource } from './azulEngine';
import {
  initGame,
  COLORS,
  WALL_LAYOUT,
  FLOOR_PENALTIES,
  isValidPlacement,
  applyDraftAction,
  executeWallTiling,
} from './azulEngine';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://sbxyukhsofjlnmfrhjzu.supabase.co';
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNieHl1a2hzb2ZqbG5tZnJoanp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzQ4MDMsImV4cCI6MjEwNjQxMDgwM30.CBwEIndFTqmXAE3G7EG3rRd1jAAg79gW6GWmK2howl4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const COLOR_STYLES: Record<Color, string> = {
  0: 'bg-blue-600 border-blue-400 text-white shadow-sm shadow-blue-500/30',
  1: 'bg-amber-400 border-amber-200 text-slate-900 shadow-sm shadow-amber-400/30',
  2: 'bg-rose-600 border-rose-400 text-white shadow-sm shadow-rose-500/30',
  3: 'bg-zinc-800 border-zinc-500 text-zinc-100 shadow-sm shadow-black/50',
  4: 'bg-slate-100 border-slate-300 text-slate-800 shadow-sm shadow-white/20',
};

const WALL_GHOST_STYLES: Record<Color, string> = {
  0: 'border-blue-500/40 bg-blue-950/30 text-blue-400/60',
  1: 'border-amber-500/40 bg-amber-950/30 text-amber-300/60',
  2: 'border-rose-500/40 bg-rose-950/30 text-rose-400/60',
  3: 'border-zinc-600/40 bg-zinc-900/40 text-zinc-400/60',
  4: 'border-slate-300/40 bg-slate-800/30 text-slate-300/60',
};

function AzulBoard({
  gameState,
  onUpdateState,
  myPlayerId,
  isLocalMode,
}: {
  gameState: GameState;
  onUpdateState: (newState: GameState) => void;
  myPlayerId: string;
  isLocalMode: boolean;
}) {
  const [selectedSource, setSelectedSource] = useState<DraftSource | null>(null);
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const turnPlayer = gameState.players[gameState.turnPlayerIndex] || gameState.players[0];
  const isMyTurn = isLocalMode ? true : turnPlayer.id === myPlayerId;
  const activeBoard = isLocalMode
    ? turnPlayer
    : gameState.players.find((p) => p.id === myPlayerId) || gameState.players[0];

  const handleSelectDraft = (source: DraftSource, color: Color) => {
    if (!isMyTurn || gameState.phase !== 'FACTORY_OFFER') return;
    setSelectedSource(source);
    setSelectedColor(color);
    setActionError(null);
  };

  const handlePlaceTiles = (targetRow: number | null) => {
    if (!selectedSource || selectedColor === null || !isMyTurn) return;

    try {
      const updated = applyDraftAction(gameState, {
        source: selectedSource,
        color: selectedColor,
        targetRow,
      });

      setSelectedSource(null);
      setSelectedColor(null);
      setActionError(null);

      if (updated.phase === 'WALL_TILING') {
        const tiledState = executeWallTiling(updated);
        onUpdateState(tiledState);
      } else {
        onUpdateState(updated);
      }
    } catch (err: any) {
      setActionError(err.message || 'Illegal placement move');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 pb-12 font-sans select-none">
      <header className="bg-slate-900 border-b border-slate-800 p-3 sticky top-0 z-20 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between text-xs">
          <div>
            <span className="text-cyan-400 font-black tracking-wider uppercase">Azul</span>
            <span className="ml-2 text-slate-400">Round {gameState.round}</span>
            {isLocalMode && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/40 font-bold">
                Local
              </span>
            )}
          </div>
          <div className="font-semibold px-2.5 py-1 rounded-full text-[11px] bg-slate-800 border border-slate-700">
            {gameState.phase === 'GAME_OVER' ? (
              <span className="text-amber-400">GAME OVER</span>
            ) : isMyTurn ? (
              <span className="text-emerald-400 animate-pulse">● Your Turn</span>
            ) : (
              <span className="text-slate-400">Waiting: {turnPlayer.name}</span>
            )}
          </div>
        </div>

        <div className="max-w-md mx-auto flex items-center justify-around gap-2 mt-2 pt-2 border-t border-slate-800/80">
          {gameState.players.map((p, idx) => (
            <div
              key={p.id}
              className={`flex-1 text-center py-1 px-1.5 rounded-lg border text-xs ${
                idx === gameState.turnPlayerIndex
                  ? 'bg-slate-800 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <div className="truncate font-medium">{p.name}</div>
              <div className="text-sm font-bold text-slate-100">{p.score} pts</div>
            </div>
          ))}
        </div>
      </header>

      <main className="max-w-md mx-auto w-full p-3 space-y-4">
        {actionError && (
          <div className="p-2.5 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs text-center">
            {actionError}
          </div>
        )}

        {/* 1. FACTORIES & CENTER POOL */}
        <section className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-3 shadow-lg">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
            Factories & Center Pool
          </h2>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {gameState.factories.map((factory, fIdx) => (
              <div
                key={fIdx}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 flex flex-col items-center justify-center min-h-[64px]"
              >
                <span className="text-[9px] text-slate-500 mb-1 font-mono">F{fIdx + 1}</span>
                {factory.length === 0 ? (
                  <span className="text-[10px] text-slate-600 italic">Empty</span>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {factory.map((tile, tIdx) => {
                      const isSelected =
                        selectedSource?.type === 'FACTORY' &&
                        selectedSource.factoryIndex === fIdx &&
                        selectedColor === tile;
                      return (
                        <button
                          key={tIdx}
                          disabled={!isMyTurn}
                          onClick={() =>
                            handleSelectDraft({ type: 'FACTORY', factoryIndex: fIdx }, tile)
                          }
                          className={`w-6 h-6 rounded border flex items-center justify-center text-[10px] font-black transition active:scale-90 ${
                            COLOR_STYLES[tile]
                          } ${isSelected ? 'ring-2 ring-cyan-400 scale-110 shadow-lg' : 'opacity-90'}`}
                        >
                          {COLORS[tile][0]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Center:</span>
              {gameState.hasFirstPlayerTokenInCenter && (
                <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-400/30">
                  1st
                </span>
              )}
            </div>

            {gameState.center.length === 0 ? (
              <span className="text-[10px] text-slate-600 italic">Pool Empty</span>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-w-[220px] justify-end">
                {gameState.center.map((tile, idx) => {
                  const isSelected =
                    selectedSource?.type === 'CENTER' && selectedColor === tile;
                  return (
                    <button
                      key={idx}
                      disabled={!isMyTurn}
                      onClick={() => handleSelectDraft({ type: 'CENTER' }, tile)}
                      className={`w-6 h-6 rounded border flex items-center justify-center text-[10px] font-black transition active:scale-90 ${
                        COLOR_STYLES[tile]
                      } ${isSelected ? 'ring-2 ring-cyan-400 scale-110 shadow-lg' : 'opacity-90'}`}
                    >
                      {COLORS[tile][0]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {selectedColor !== null && (
          <div className="p-2.5 bg-cyan-950/60 border border-cyan-500/40 rounded-xl text-center text-xs text-cyan-200">
            Selected: <strong className="text-cyan-400">{COLORS[selectedColor]}</strong>. Tap a
            pattern line row or floor below to place.
          </div>
        )}

        {/* 2. PLAYER BOARD */}
        <section className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-3 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {activeBoard.name}&apos;s Mosaic Board
            </h2>
            <span className="text-xs font-bold text-cyan-400">{activeBoard.score} Pts</span>
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="space-y-1.5">
              <span className="block text-[9px] text-slate-500 font-semibold uppercase tracking-wider mb-1 text-right pr-1">
                Pattern Lines
              </span>
              {activeBoard.patternLines.map((line, r) => {
                const validation =
                  selectedColor !== null
                    ? isValidPlacement(activeBoard, selectedColor, r)
                    : { valid: false };

                return (
                  <button
                    key={r}
                    disabled={selectedColor === null || !validation.valid || !isMyTurn}
                    onClick={() => handlePlaceTiles(r)}
                    className={`w-full flex items-center justify-end gap-1 p-1 rounded-lg border transition ${
                      selectedColor !== null && validation.valid
                        ? 'border-emerald-400/80 bg-emerald-950/30 hover:bg-emerald-900/50 active:scale-98 cursor-pointer'
                        : 'border-transparent bg-slate-950/40'
                    }`}
                  >
                    {Array.from({ length: line.capacity }).map((_, slotIdx) => {
                      const isFilled = slotIdx < line.count;
                      return (
                        <div
                          key={slotIdx}
                          className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-black border ${
                            isFilled && line.color !== null
                              ? COLOR_STYLES[line.color]
                              : 'border-slate-800 bg-slate-900 text-slate-700'
                          }`}
                        >
                          {isFilled && line.color !== null ? COLORS[line.color][0] : ''}
                        </div>
                      );
                    })}
                  </button>
                );
              })}
            </div>

            <div>
              <span className="block text-[9px] text-slate-500 font-semibold uppercase tracking-wider mb-1">
                Wall Mosaic (5×5)
              </span>
              <div className="grid grid-cols-5 gap-1 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800">
                {WALL_LAYOUT.map((row, r) =>
                  row.map((wallColor, c) => {
                    const isTiled = activeBoard.wall[r][c];
                    return (
                      <div
                        key={`${r}-${c}`}
                        title={COLORS[wallColor]}
                        className={`w-full aspect-square rounded flex items-center justify-center text-[9px] font-bold border transition ${
                          isTiled
                            ? `${COLOR_STYLES[wallColor]} scale-95`
                            : `${WALL_GHOST_STYLES[wallColor]} border-dashed`
                        }`}
                      >
                        {COLORS[wallColor][0]}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Floor Line */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">
                Floor Line (Penalties)
              </span>
              {selectedColor !== null && isMyTurn && (
                <button
                  onClick={() => handlePlaceTiles(null)}
                  className="text-[10px] px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-md font-bold active:scale-95"
                >
                  Dump to Floor
                </button>
              )}
            </div>

            <div className="flex gap-1">
              {FLOOR_PENALTIES.map((penalty, idx) => {
                const item = activeBoard.floor[idx];
                return (
                  <div
                    key={idx}
                    className={`flex-1 aspect-square max-h-9 rounded-lg border flex flex-col items-center justify-center text-[9px] font-bold ${
                      item
                        ? item === 'FIRST_PLAYER'
                          ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                          : COLOR_STYLES[item]
                        : 'border-slate-800 bg-slate-950/60 text-slate-600'
                    }`}
                  >
                    <span>
                      {item === 'FIRST_PLAYER' ? '1st' : item !== undefined ? COLORS[item][0] : ''}
                    </span>
                    <span className="text-[8px] text-rose-400">{penalty}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function App() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLocalMode, setIsLocalMode] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const myId = useRef('p_' + Math.random().toString(36).substring(2, 8));
  const myName = useRef('');

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const handleStartLocalTest = (numPlayers: number = 2) => {
    const testPlayers = [
      { id: 'p_1', name: 'Player 1' },
      { id: 'p_2', name: 'Player 2' },
      ...(numPlayers >= 3 ? [{ id: 'p_3', name: 'Player 3' }] : []),
      ...(numPlayers >= 4 ? [{ id: 'p_4', name: 'Player 4' }] : []),
    ];
    const initial = initGame(testPlayers);
    setIsLocalMode(true);
    setGameState(initial);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRoom = roomCode.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanName || cleanRoom.length !== 4) {
      setError('Please enter a nickname and a 4-letter room code.');
      return;
    }

    myName.current = cleanName;

    // Self-register immediately in local state
    const selfPlayer: Player = {
      id: myId.current,
      name: cleanName,
      isHost: true,
      isReady: false,
    };
    setPlayers([selfPlayer]);

    const channel = supabase.channel(`azul_lobby_${cleanRoom}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'PLAYER_PING' }, ({ payload }) => {
        if (!payload?.player) return;
        const incoming: Player = payload.player;

        setPlayers((prev) => {
          const exists = prev.some((p) => p.id === incoming.id);
          const updated = exists
            ? prev.map((p) => (p.id === incoming.id ? { ...p, ...incoming } : p))
            : [...prev, incoming];

          const sorted = [...updated].sort((a, b) => a.id.localeCompare(b.id));
          return sorted.map((p, idx) => ({ ...p, isHost: idx === 0 }));
        });

        // Pong response
        channel.send({
          type: 'broadcast',
          event: 'PLAYER_PONG',
          payload: {
            player: {
              id: myId.current,
              name: myName.current,
              isHost: false,
              isReady: players.find((p) => p.id === myId.current)?.isReady ?? false,
            },
          },
        });
      })
      .on('broadcast', { event: 'PLAYER_PONG' }, ({ payload }) => {
        if (!payload?.player) return;
        const incoming: Player = payload.player;

        setPlayers((prev) => {
          const exists = prev.some((p) => p.id === incoming.id);
          const updated = exists
            ? prev.map((p) => (p.id === incoming.id ? { ...p, ...incoming } : p))
            : [...prev, incoming];

          const sorted = [...updated].sort((a, b) => a.id.localeCompare(b.id));
          return sorted.map((p, idx) => ({ ...p, isHost: idx === 0 }));
        });
      })
      .on('broadcast', { event: 'PLAYER_READY' }, ({ payload }) => {
        if (!payload?.playerId) return;
        setPlayers((prev) =>
          prev.map((p) => (p.id === payload.playerId ? { ...p, isReady: payload.isReady } : p))
        );
      })
      .on('broadcast', { event: 'GAME_START' }, ({ payload }) => {
        if (payload?.state) {
          setGameState(payload.state);
        }
      })
      .on('broadcast', { event: 'GAME_MOVE' }, ({ payload }) => {
        if (payload?.state) {
          setGameState(payload.state);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setJoined(true);
          setError(null);

          channel.send({
            type: 'broadcast',
            event: 'PLAYER_PING',
            payload: { player: selfPlayer },
          });
        } else if (status === 'CHANNEL_ERROR') {
          setError('Could not connect to room. Please try again.');
        }
      });

    channelRef.current = channel;
  };

  const toggleReady = () => {
    const me = players.find((p) => p.id === myId.current);
    if (!me || !channelRef.current) return;

    const nextReady = !me.isReady;
    setPlayers((prev) =>
      prev.map((p) => (p.id === myId.current ? { ...p, isReady: nextReady } : p))
    );

    channelRef.current.send({
      type: 'broadcast',
      event: 'PLAYER_READY',
      payload: { playerId: myId.current, isReady: nextReady },
    });
  };

  const handleStartGame = () => {
    if (players.length < 2) return;
    const initial = initGame(players.map((p) => ({ id: p.id, name: p.name })));
    setGameState(initial);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'GAME_START',
      payload: { state: initial },
    });
  };

  const handleUpdateGameState = (newState: GameState) => {
    setGameState(newState);
    if (!isLocalMode && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'GAME_MOVE',
        payload: { state: newState },
      });
    }
  };

  if (gameState) {
    return (
      <AzulBoard
        gameState={gameState}
        onUpdateState={handleUpdateGameState}
        myPlayerId={myId.current}
        isLocalMode={isLocalMode}
      />
    );
  }

  const me = players.find((p) => p.id === myId.current);
  const isHost = me?.isHost ?? false;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black tracking-widest text-cyan-400">AZUL</h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">
            Tile Drafting Board Game
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950 border border-red-500 rounded-xl text-red-300 text-xs text-center font-medium">
            {error}
          </div>
        )}

        {!joined ? (
          <div className="space-y-4">
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Your Nickname
                </label>
                <input
                  type="text"
                  maxLength={14}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Papa"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-400 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Room Code (4 Letters)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  required
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="AZUL"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center uppercase tracking-widest font-mono text-lg focus:outline-none focus:border-cyan-400 text-cyan-400 font-bold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl transition active:scale-95 text-sm uppercase tracking-wider"
              >
                Enter Online Lobby
              </button>
            </form>

            <div className="pt-3 border-t border-slate-700/80">
              <button
                onClick={() => handleStartLocalTest(2)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition active:scale-95 text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20"
              >
                🎮 Play Local Pass & Play (2 Players)
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Room Code
                </span>
                <span className="text-xl font-mono font-bold tracking-widest text-cyan-400">
                  {roomCode}
                </span>
              </div>
              <span className="text-xs font-semibold bg-slate-700 px-2.5 py-1 rounded-full text-slate-300">
                {players.length} / 4 Players
              </span>
            </div>

            <div className="space-y-2">
              {players.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition ${
                    p.id === myId.current
                      ? 'bg-slate-700/60 border-cyan-400/50'
                      : 'bg-slate-950/40 border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">
                      {p.name} {p.id === myId.current && <span className="text-xs text-cyan-400">(You)</span>}
                    </span>
                    {p.isHost && (
                      <span className="text-[9px] bg-amber-400/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-400/30">
                        HOST
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      p.isReady ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {p.isReady ? 'Ready' : 'Waiting'}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={toggleReady}
                className={`w-full py-3 rounded-xl font-bold transition text-sm ${
                  me?.isReady
                    ? 'bg-slate-700 text-slate-300 border border-slate-600'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                }`}
              >
                {me?.isReady ? 'Cancel Ready' : 'Ready Up'}
              </button>

              {isHost && (
                <button
                  onClick={handleStartGame}
                  disabled={players.length < 2}
                  className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition text-sm"
                >
                  Start Game {players.length < 2 && '(Min 2 Players)'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}