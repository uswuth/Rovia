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

export const getMeetingSocket = (visitorId?: string): MeetingSocket => {
  if (socket && !socket.disconnected) return socket;
  if (socket?.disconnected) {
    socket.connect();
    return socket;
  }

  const token = getAccessToken();
  socket = io('/', {
    auth: token ? { token } : { visitorId },
    transports: ['polling', 'websocket']
  });
  return socket;
};

export const disconnectMeetingSocket = (): void => {
  socket?.disconnect();
  socket = null;
};
