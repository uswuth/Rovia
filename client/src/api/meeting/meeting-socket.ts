import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/api/client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from './webrtc.types';

export type MeetingSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Lazily-created socket for signalling. The JWT travels in the handshake, so the server can verify it before allowing any room join. */
let socket: MeetingSocket | null = null;

export const getMeetingSocket = (visitorId?: string): MeetingSocket => {
  if (socket && !socket.disconnected) return socket;
  if (socket?.disconnected) {
    socket.connect();
    return socket;
  }

  const token = getAccessToken();
  // Strip trailing '/api/v1' or '/api' if present so socket.io connects to the server root
  const rawUrl = (import.meta.env.VITE_API_BASE_URL as string || '').replace(/\/+$/, '');
  const socketUrl = rawUrl.replace(/\/api(\/v\d+)?$/i, '');

  socket = io(socketUrl || window.location.origin, {
    auth: token ? { token } : { visitorId },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
  return socket;
};

export const disconnectMeetingSocket = (): void => {
  socket?.disconnect();
  socket = null;
};
