import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { corsOptions } from '../config/cors.js';
import { env } from '../config/env.js';
import { Meeting } from '../models/meeting.model.js';
import { assertObjectId } from '../utils/objectId.js';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData
} from '../types/index.js';

type TypedSocketServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let io: TypedSocketServer | null = null;

export const initSocket = (httpServer: HTTPServer): TypedSocketServer => {
  io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: corsOptions
  });

  /**
 * Verifies the handshake token and returns the caller's identity. The same
 * JWT the REST API uses, so a socket client is exactly as trusted as a request.
 * Returns null for a missing, malformed or expired token.
 */
const resolveIdentity = (token?: string): { userId: string; organizationId: string } | null => {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { id?: string; organizationId?: string };
    if (!decoded.id) return null;
    return { userId: decoded.id, organizationId: decoded.organizationId ?? '' };
  } catch {
    return null;
  }
};

io.on('connection', (socket: TypedSocket) => {
    logger.info(`Socket client connected: ${socket.id}`);

    // Signalling is only ever allowed for an authenticated user. The JWT is
    // read in the handshake so a room name alone never grants access.
    const token = socket.handshake.auth?.token as string | undefined;
    const identity = resolveIdentity(token);
    if (!identity) {
      logger.warn(`Socket rejected: ${socket.id} (no valid token)`);
      socket.disconnect(true);
      return;
    }
    socket.data.userId = identity.userId;
    socket.data.organizationId = identity.organizationId;

    /**
     * Joining a meeting room re-checks the same rules the REST API enforces:
     * the meeting must exist in the caller's organization, and an INVITE_ONLY
     * meeting only admits the assigned roster.
     */
    socket.on('meeting:join', async (meetingId: string, ack?) => {
      const userId = socket.data.userId ?? '';
      try {
        assertObjectId(meetingId, 'meetingId');
        const meeting = await Meeting.findOne({
          _id: meetingId,
          organization_id: socket.data.organizationId
        });
        if (!meeting) {
          ack?.({ ok: false, error: 'Meeting not found' });
          return;
        }

        const isOnRoster = meeting.meeting_participants.some((p) => p.userId === userId);
        if (meeting.meeting_join_mode === 'INVITE_ONLY' && !isOnRoster) {
          ack?.({ ok: false, error: 'This meeting is invite only' });
          return;
        }

        await socket.join(`meeting:${meetingId}`);
        const participants = meeting.meeting_participants.map((p) => p.userId);
        ack?.({ ok: true, peers: participants.filter((id) => id !== socket.data.userId) });
        socket.to(`meeting:${meetingId}`).emit('meeting:peer-joined', { userId });
      } catch (error) {
        logger.error(`meeting:join failed: ${(error as Error).message}`);
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on('meeting:leave', (meetingId: string) => {
      void socket.leave(`meeting:${meetingId}`);
      socket.to(`meeting:${meetingId}`).emit('meeting:peer-left', { userId: socket.data.userId ?? '' });
    });

    // SDP and ICE are relayed untouched. The server never inspects media.
    const relay = (event: 'webrtc:offer' | 'webrtc:answer' | 'webrtc:ice', field: string) => {
      socket.on(event, (payload: { meetingId: string; to: string; [key: string]: unknown }) => {
        if (!payload?.meetingId || !payload?.to) return;
        io?.to(payload.to).emit(field as keyof ServerToClientEvents, {
          from: socket.data.userId ?? '',
          payload
        } as never);
      });
    };
    relay('webrtc:offer', 'webrtc:offer');
    relay('webrtc:answer', 'webrtc:answer');
    relay('webrtc:ice', 'webrtc:ice');

    /** Transient in-call state changes: mute, camera, screen share, hand. */
    socket.on('meeting:state', (payload: { meetingId: string; state: Record<string, boolean | string> }) => {
      if (!payload?.meetingId) return;
      socket.to(`meeting:${payload.meetingId}`).emit('meeting:state', {
        userId: socket.data.userId ?? '',
        state: payload.state
      });
    });

    socket.on('disconnect', (reason: string) => {
      logger.info(`Socket client disconnected: ${socket.id} (reason: ${reason})`);
    });
  });

  logger.info('Socket.io server initialized and attached to HTTP server.');
  return io;
};

export const getIO = (): TypedSocketServer => {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet.');
  }
  return io;
};
