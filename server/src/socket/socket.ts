import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { corsOptions } from '../config/cors.js';
import { env } from '../config/env.js';
import { Meeting, MeetingParticipantClass } from '../models/meeting.model.js';
import { Project } from '../models/project.model.js';
import { Team } from '../models/team.model.js';
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

        // Access check across 3 categories:
        // 1. Team meeting (org > project > team)
        // 2. Project meeting (org > project)
        // 3. Organization meeting (org)
        let hasAccess = Boolean(socket.data.isSuperAdmin || meeting.created_by.toString() === userId);

        if (!hasAccess && meeting.meeting_participants.some((p) => String(p.userId) === userId)) {
          hasAccess = true;
        }

        if (!hasAccess && meeting.team_id) {
          const team = await Team.findById(meeting.team_id).lean();
          if (team) {
            const teamMembers = [...(team.team_hosts || []), ...(team.team_members || [])].map((id) => String(id));
            if (teamMembers.includes(userId)) hasAccess = true;
          }
        }

        if (!hasAccess && meeting.project_id) {
          const project = await Project.findById(meeting.project_id).lean();
          if (project) {
            const projMembers = [
              String(project.created_by || ''),
              ...(project.project_hosts || []).map((id) => String(id)),
              ...(project.project_members || []).map((id) => String(id)),
            ];
            if (projMembers.includes(userId)) hasAccess = true;
          }
        }

        if (!hasAccess && !meeting.project_id && !meeting.team_id) {
          // General / Org scope meeting: open to any member of the organization
          hasAccess = isOrgMember;
        }

        if (!hasAccess) {
          ack?.({ ok: false, error: 'Access denied: You do not have permission to join this meeting' });
          return;
        }

        await socket.join(`meeting:${realMeetingId}`);
        socket.data.meetingId = realMeetingId;
        (socket.data as Record<string, unknown>).meetingCode = meeting.meeting_join_code;

        let participantRecord = meeting.meeting_participants.find((p) => String(p.userId) === userId);
        if (!participantRecord) {
          participantRecord = new MeetingParticipantClass();
          participantRecord.userId = userId;
          participantRecord.participant_role = 'MEMBER';
          participantRecord.participant_status = 'JOINED';
          participantRecord.joined_at = new Date();
          meeting.meeting_participants.push(participantRecord);
        } else {
          participantRecord.participant_status = 'JOINED';
          participantRecord.joined_at = new Date();
          participantRecord.left_at = null;
        }
        await meeting.save();

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

    socket.on('meeting:leave', async (meetingId: string) => {
      const targetId = socket.data.meetingId || meetingId;
      void socket.leave(`meeting:${targetId}`);
      delete socket.data.meetingId;
      delete (socket.data as Record<string, unknown>).meetingCode;
      socket.to(`meeting:${targetId}`).emit('meeting:peer-left', { userId: socket.data.userId ?? '' });

      try {
        const meeting = targetId.match(/^[0-9a-fA-F]{24}$/)
          ? await Meeting.findById(targetId)
          : await Meeting.findOne({ meeting_join_code: targetId });
        if (meeting) {
          const participantRecord = meeting.meeting_participants.find((p) => String(p.userId) === socket.data.userId);
          if (participantRecord && participantRecord.participant_status !== 'LEFT') {
            participantRecord.participant_status = 'LEFT';
            participantRecord.left_at = new Date();
            await meeting.save();
          }
        }
      } catch {
        // Non-critical
      }
    });

    socket.on('meeting:end', (meetingId: string) => {
      const targetId = socket.data.meetingId || meetingId;
      if (!targetId) return;
      io?.to(`meeting:${targetId}`).emit('meeting:ended', { meetingId: targetId });
    });

    // SDP and ICE are relayed untouched. The server never inspects media.
    // Only a sender that actually joined this meeting may relay, and the target
    // is the receiver's per-user room — never an arbitrary room name.
    const relay = (event: 'webrtc:offer' | 'webrtc:answer' | 'webrtc:ice', field: string) => {
      socket.on(event, (payload: { meetingId: string; to: string; [key: string]: unknown }) => {
        if (!payload?.meetingId || !payload?.to) return;
        const meetingCode = (socket.data as Record<string, unknown>).meetingCode;
        if (payload.meetingId !== socket.data.meetingId && payload.meetingId !== meetingCode) return;
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
          const meetingCode = (socket.data as Record<string, unknown>).meetingCode as string | undefined;
          if (!payload?.meetingId || !joinedMeetingId) {
            ack?.({ ok: false, error: 'You are not in this meeting' });
            return;
          }
          if (payload.meetingId !== joinedMeetingId && payload.meetingId !== meetingCode) {
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

          const meeting = await Meeting.findById(joinedMeetingId);
          if (!meeting) {
            ack?.({ ok: false, error: 'Meeting not found' });
            return;
          }

          const userId = socket.data.userId ?? '';
          const isCreator = meeting.created_by.toString() === userId;
          const participant = meeting.meeting_participants.find((p) => String(p.userId) === userId);
          if (participant && participant.can_use_chat === false && !isCreator) {
            ack?.({ ok: false, error: 'Chat is disabled for you in this meeting' });
            return;
          }

          io?.to(`meeting:${joinedMeetingId}`).emit('meeting:message', {
            messageId: randomUUID(),
            meetingId: payload.meetingId,
            from: userId,
            text,
            at: new Date().toISOString()
          });
          ack?.({ ok: true });
        } catch (error) {
          ack?.({ ok: false, error: (error as Error).message || 'Could not send message' });
        }
      }
    );

    socket.on('meeting:typing', (payload: { meetingId: string; isTyping: boolean; userName?: string }) => {
      const targetId = socket.data.meetingId || payload?.meetingId;
      if (!targetId) return;
      socket.to(`meeting:${targetId}`).emit('meeting:typing', {
        userId: socket.data.userId ?? '',
        userName: payload.userName || '',
        isTyping: Boolean(payload.isTyping)
      });
    });

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
