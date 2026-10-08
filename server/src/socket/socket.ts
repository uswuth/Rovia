import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { corsOptions } from '../config/cors.js';
import { env } from '../config/env.js';
import { Meeting } from '../models/meeting.model.js';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData
} from '../types/index.js';
import { assertMeetingCanChat } from '../services/meeting.service.js';
import { randomUUID } from 'node:crypto';

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

/** Chat messages are bounded server-side; the client mirrors this limit. */
const MAX_CHAT_MESSAGE_CHARS = 2000;

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
   * Rejects any connection without a valid JWT token.
   */
  const resolveIdentity = (
    token?: string
  ): { userId: string; organizationId: string; isSuperAdmin?: boolean } | null => {
    if (!token) return null;
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { id?: string; organizationId?: string; isSuperAdmin?: boolean };
      if (!decoded.id) return null;
      return {
        userId: decoded.id,
        organizationId: decoded.organizationId ?? '',
        isSuperAdmin: Boolean(decoded.isSuperAdmin)
      };
    } catch {
      return null;
    }
  };

  io.on('connection', (socket: TypedSocket) => {
    logger.info(`Socket client connected: ${socket.id}`);

    const token = socket.handshake.auth?.token as string | undefined;
    const identity = resolveIdentity(token);

    if (!identity) {
      logger.warn(`Socket rejected: ${socket.id} (unauthenticated, JWT required)`);
      socket.disconnect(true);
      return;
    }

    socket.data.userId = identity.userId;
    socket.data.organizationId = identity.organizationId;
    socket.data.isSuperAdmin = identity.isSuperAdmin ?? false;

    // Every socket joins a per-user room so signalling addressed to a userId
    // (`io.to(user:<id>)`) always has a live target room to land in.
    void socket.join(`user:${identity.userId}`);

    socket.on('meeting:join', async (meetingId: string, ack?) => {
      const userId = socket.data.userId ?? '';
      try {
        let meeting;
        if (meetingId.match(/^[0-9a-fA-F]{24}$/)) {
          meeting = await Meeting.findById(meetingId);
        } else {
          meeting = await Meeting.findOne({ meeting_join_code: meetingId });
        }

        if (!meeting) {
          ack?.({ ok: false, error: 'Meeting not found' });
          return;
        }

        const realMeetingId = meeting._id.toString();

        // Check Organization Access: meeting organization must match user's organization (unless SuperAdmin)
        const isOrgMember =
          socket.data.isSuperAdmin ||
          (socket.data.organizationId && meeting.organization_id.toString() === socket.data.organizationId);

        if (!isOrgMember) {
          ack?.({ ok: false, error: 'Access denied: You must be a member of this organization' });
          return;
        }

        // Check Project Team Roster Access: user must be on roster, creator, or superadmin
        const isOnRoster = meeting.meeting_participants.some((p) => String(p.userId) === userId);
        const isHostOrCreator = meeting.created_by.toString() === userId || socket.data.isSuperAdmin;

        if (!isOnRoster && !isHostOrCreator) {
          ack?.({ ok: false, error: 'Access denied: You are not assigned to this project team meeting' });
          return;
        }

        await socket.join(`meeting:${realMeetingId}`);
        socket.data.meetingId = realMeetingId;

        const room = io?.sockets.adapter.rooms.get(`meeting:${realMeetingId}`);
        const live = new Set<string>();
        if (room) {
          for (const socketId of room) {
            const peerSocket = io?.sockets.sockets.get(socketId);
            const peerId = peerSocket?.data.userId as string | undefined;
            if (peerId && peerId !== userId) live.add(String(peerId));
          }
        }

        ack?.({ ok: true, peers: Array.from(live) });
        socket.to(`meeting:${realMeetingId}`).emit('meeting:peer-joined', { userId });
      } catch (error) {
        logger.error(`meeting:join failed: ${(error as Error).message}`);
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on('meeting:leave', (meetingId: string) => {
      const targetId = socket.data.meetingId || meetingId;
      void socket.leave(`meeting:${targetId}`);
      delete socket.data.meetingId;
      socket.to(`meeting:${targetId}`).emit('meeting:peer-left', { userId: socket.data.userId ?? '' });
    });

    // SDP and ICE are relayed untouched. The server never inspects media.
    // Only a sender that actually joined this meeting may relay, and the target
    // is the receiver's per-user room — never an arbitrary room name.
    const relay = (event: 'webrtc:offer' | 'webrtc:answer' | 'webrtc:ice', field: string) => {
      socket.on(event, (payload: { meetingId: string; to: string; [key: string]: unknown }) => {
        if (!payload?.meetingId || !payload?.to) return;
        if (payload.meetingId !== socket.data.meetingId) return;
        io?.to(`user:${payload.to}`).emit(field as keyof ServerToClientEvents, {
          from: socket.data.userId ?? '',
          ...payload,
        } as never);
      });
    };
    relay('webrtc:offer', 'webrtc:offer');
    relay('webrtc:answer', 'webrtc:answer');
    relay('webrtc:ice', 'webrtc:ice');

    /** Transient in-call state changes: mute, camera, screen share, hand. */
    socket.on('meeting:state', (payload: { meetingId: string; state: Record<string, boolean | string> }) => {
      if (!payload?.meetingId || payload.meetingId !== socket.data.meetingId) return;
      socket.to(`meeting:${payload.meetingId}`).emit('meeting:state', {
        userId: socket.data.userId ?? '',
        state: payload.state
      });
    });

    /**
     * In-meeting chat. Roster membership and can_use_chat are re-checked
     * against the database on every message with the same guard the REST Q&A
     * routes use, so a host disabling chat takes effect immediately.
     */
    socket.on(
      'meeting:message',
      async (
        payload: { meetingId: string; text: string },
        ack?: (result: { ok: boolean; error?: string }) => void
      ) => {
        try {
          const joinedMeetingId = socket.data.meetingId ?? '';
          if (!payload?.meetingId || !joinedMeetingId || payload.meetingId !== joinedMeetingId) {
            ack?.({ ok: false, error: 'You are not in this meeting' });
            return;
          }
          const text = (payload.text ?? '').trim();
          if (!text) {
            ack?.({ ok: false, error: 'Message cannot be empty' });
            return;
          }
          if (text.length > MAX_CHAT_MESSAGE_CHARS) {
            ack?.({ ok: false, error: `Message is too long (max ${MAX_CHAT_MESSAGE_CHARS} characters)` });
            return;
          }

          const meeting = await Meeting.findOne({
            _id: joinedMeetingId,
            organization_id: socket.data.organizationId
          });
          if (!meeting) {
            ack?.({ ok: false, error: 'Meeting not found' });
            return;
          }
          assertMeetingCanChat(meeting, socket.data.userId ?? '');

          io?.to(`meeting:${joinedMeetingId}`).emit('meeting:message', {
            messageId: randomUUID(),
            meetingId: joinedMeetingId,
            from: socket.data.userId ?? '',
            text,
            at: new Date().toISOString()
          });
          ack?.({ ok: true });
        } catch (error) {
          ack?.({ ok: false, error: (error as Error).message || 'Could not send message' });
        }
      }
    );

    socket.on('disconnect', (reason: string) => {
      logger.info(`Socket client disconnected: ${socket.id} (reason: ${reason})`);
      const meetingId = socket.data.meetingId;
      const userId = socket.data.userId;
      if (meetingId && userId) {
        socket.to(`meeting:${meetingId}`).emit('meeting:peer-left', { userId });
      }
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
