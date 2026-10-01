import { useState } from 'react';
import type { GameState, Color, DraftSource } from './azulEngine';
import {
  COLORS,
  WALL_LAYOUT,
  FLOOR_PENALTIES,
  isValidPlacement,
  applyDraftAction,
  executeWallTiling,
} from './azulEngine';

export interface AzulBoardProps {
  gameState: GameState;
  onUpdateState: (newState: GameState) => void;
  myPlayerId: string;
}

const COLOR_STYLES: Record<Color, string> = {
  0: 'bg-blue-600 border-blue-400 text-white',
  1: 'bg-amber-400 border-amber-200 text-slate-900',
  2: 'bg-rose-600 border-rose-400 text-white',
  3: 'bg-zinc-800 border-zinc-600 text-zinc-100',
  4: 'bg-slate-100 border-slate-300 text-slate-800',
};

export default function AzulBoard({ gameState, onUpdateState, myPlayerId }: AzulBoardProps) {
  const [selectedSource, setSelectedSource] = useState<DraftSource | null>(null);
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const turnPlayer = gameState.players[gameState.turnPlayerIndex];
  const isMyTurn = turnPlayer.id === myPlayerId;
  const myBoard = gameState.players.find((p) => p.id === myPlayerId) || gameState.players[0];

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
            Selected: <strong className="text-cyan-400">{COLORS[selectedColor]}</strong>. Tap a pattern line row or floor below.
          </div>
        )}

        <section className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-3 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {myBoard.name}&apos;s Mosaic Board
            </h2>
            <span className="text-xs font-bold text-cyan-400">{myBoard.score} Pts</span>
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="space-y-1.5">
              <span className="block text-[9px] text-slate-500 font-semibold uppercase tracking-wider mb-1 text-right pr-1">
                Pattern Lines
              </span>
              {myBoard.patternLines.map((line, r) => {
                const validation =
                  selectedColor !== null
                    ? isValidPlacement(myBoard, selectedColor, r)
                    : { valid: false };

                return (
                  <button
                    key={r}
                    disabled={!selectedColor || !validation.valid || !isMyTurn}
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
                    const isTiled = myBoard.wall[r][c];
                    return (
                      <div
                        key={`${r}-${c}`}
                        className={`w-full aspect-square rounded flex items-center justify-center text-[9px] font-bold border transition ${
                          isTiled
                            ? `${COLOR_STYLES[wallColor]} shadow-sm`
                            : 'border-slate-800/80 bg-slate-900/60 opacity-30 text-slate-500'
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

          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Floor Line (Penalties)</span>
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
                const item = myBoard.floor[idx];
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
                    <span>{item === 'FIRST_PLAYER' ? '1st' : item !== undefined ? COLORS[item][0] : ''}</span>
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