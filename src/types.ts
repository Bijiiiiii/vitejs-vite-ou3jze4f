export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
}

export interface LobbyState {
  roomId: string;
  players: Player[];
  status: 'LOBBY' | 'IN_GAME';
}