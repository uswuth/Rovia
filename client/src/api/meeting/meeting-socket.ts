import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/api/client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from './webrtc.types';

export type MeetingSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Lazily-created socket for signalling. The JWT travels in the handshake, so
 * the server can verify it before allowing any room join.
 */
let socket: MeetingSocket | null = null;

export const getMeetingSocket = (): MeetingSocket => {
  if (socket?.connected) return socket;
  socket?.disconnect();

  socket = io('/', {
    auth: { token: getAccessToken() },
    transports: ['websocket', 'polling']
  });
  return socket;
};

export const disconnectMeetingSocket = (): void => {
  socket?.disconnect();
  socket = null;
};
