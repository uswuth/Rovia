import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { socketCorsOptions } from '../config/cors.js';
import { env } from '../config/env.js';
import { Meeting, MeetingParticipantClass } from '../models/meeting.model.js';
import { Project } from '../models/project.model.js';
import { Team } from '../models/team.model.js';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  RaisedHand
} from '../types/index.js';
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
const meetingRaisedHands = new Map<string, RaisedHand[]>();

export interface LiveCaptionTurn {
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: number;
}

export const meetingLiveTranscripts = new Map<string, LiveCaptionTurn[]>();

export const initSocket = (httpServer: HTTPServer): TypedSocketServer => {
  io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: socketCorsOptions
  });

  /** Verifies the handshake token; a socket client is trusted exactly as much as a REST request. */
  const resolveIdentity = (
    token?: string
  ): { userId: string; organizationId: string; isSuperAdmin?: boolean } | null => {
    if (!token) return null;
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
        id?: string;
        userId?: string;
        organizationId?: string;
        isSuperAdmin?: boolean;
        isServerAdmin?: boolean;
        role?: string;
        userRole?: string;
      };
      const userId = decoded.id || decoded.userId;
      if (!userId) return null;
      const role = (decoded.userRole || decoded.role || '').toUpperCase();
      // Only a control-plane (ServerAdmin) token is platform-wide. Organization owners
      // also carry isSuperAdmin, so the flag alone must never widen tenant scope.
      const isSuperAdmin = Boolean(decoded.isServerAdmin === true && role === 'SERVERADMIN');
      return {
        userId,
        organizationId: decoded.organizationId ?? '',
        isSuperAdmin
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

    // Join a per-user room so `io.to(user:<id>)` signalling always has a live target.
    void socket.join(`user:${identity.userId}`);

    socket.on('meeting:join', async (meetingId: string, ack?: (result: { ok: boolean; peers?: string[]; error?: string }) => void) => {
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

        const isOrgMember =
          socket.data.isSuperAdmin ||
          (socket.data.organizationId && meeting.organization_id.toString() === socket.data.organizationId);

        if (!isOrgMember) {
          ack?.({ ok: false, error: 'Access denied: You must be a member of this organization' });
          return;
        }

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
        const currentHands = meetingRaisedHands.get(realMeetingId) || [];
        socket.emit('meeting:hands-updated', { hands: currentHands });
      } catch (error) {
        logger.error(`meeting:join failed: ${(error as Error).message}`);
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on('meeting:leave', async (meetingId: string) => {
      const targetId = socket.data.meetingId || meetingId;
      const leavingUserId = socket.data.userId;
      void socket.leave(`meeting:${targetId}`);
      delete socket.data.meetingId;
      delete (socket.data as Record<string, unknown>).meetingCode;
      socket.to(`meeting:${targetId}`).emit('meeting:peer-left', { userId: leavingUserId ?? '' });

      if (targetId && leavingUserId) {
        const hands = meetingRaisedHands.get(targetId);
        if (hands && hands.some((h) => h.userId === leavingUserId)) {
          const updated = hands.filter((h) => h.userId !== leavingUserId);
          meetingRaisedHands.set(targetId, updated);
          io?.to(`meeting:${targetId}`).emit('meeting:hands-updated', { hands: updated });
        }
      }

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

    socket.on('meeting:end', async (payload: string | { meetingId: string; aiSummaryEnabled?: boolean }) => {
      const meetingId = typeof payload === 'string' ? payload : payload?.meetingId;
      const targetId = socket.data.meetingId || meetingId;
      if (!targetId) return;

      const userId = socket.data.userId;
      if (!userId) return;

      const aiSummaryEnabled = typeof payload === 'object' && payload !== null ? Boolean(payload.aiSummaryEnabled) : false;

      try {
        const meeting = targetId.match(/^[0-9a-fA-F]{24}$/)
          ? await Meeting.findById(targetId)
          : await Meeting.findOne({ meeting_join_code: targetId });

        if (!meeting) return;

        const isCreator = meeting.created_by.toString() === userId;
        const participant = meeting.meeting_participants.find((p) => String(p.userId) === userId);
        const isHost = participant?.participant_role === 'HOST';
        const isSuperAdmin = socket.data.isSuperAdmin;

        if (!isCreator && !isHost && !isSuperAdmin) {
          logger.warn(`Unauthorized meeting:end attempt by user ${userId} on meeting ${targetId}`);
          return;
        }

        meetingRaisedHands.delete(targetId);
        io?.to(`meeting:${targetId}`).emit('meeting:ended', { meetingId: targetId });

        // Also trigger caption compilation if ended via socket directly
        import('../services/meeting-caption-summary.service.js')
          .then((m) => m.processMeetingEndCaptions(meeting._id.toString(), meeting.organization_id.toString(), userId, aiSummaryEnabled))
          .catch((err) => {
            logger.error(`Error processing end captions via socket: ${(err as Error).message}`);
          });
      } catch (err) {
        logger.error(`Error ending meeting via socket: ${(err as Error).message}`);
      }
    });

    // SDP/ICE are relayed untouched; only a joined member may relay, and only to the target's user room.
    const relay = (event: 'webrtc:offer' | 'webrtc:answer' | 'webrtc:ice', field: 'webrtc:offer' | 'webrtc:answer' | 'webrtc:ice') => {
      socket.on(event, (payload: { meetingId: string; to: string; [key: string]: unknown }) => {
        if (!payload?.meetingId || !payload?.to) return;
        const meetingCode = (socket.data as Record<string, unknown>).meetingCode;
        if (payload.meetingId !== socket.data.meetingId && payload.meetingId !== meetingCode) return;
        io?.to(`user:${payload.to}`).emit(field, {
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

    socket.on('meeting:hand-raise', (payload: { meetingId: string; raised: boolean; userName?: string }) => {
      const targetId = socket.data.meetingId || payload?.meetingId;
      const userId = socket.data.userId;
      if (!targetId || !userId) return;

      let hands = meetingRaisedHands.get(targetId) || [];
      if (payload.raised) {
        if (!hands.some((h) => h.userId === userId)) {
          hands = [...hands, { userId, userName: payload.userName, raisedAt: Date.now() }];
        }
      } else {
        hands = hands.filter((h) => h.userId !== userId);
      }
      meetingRaisedHands.set(targetId, hands);
      io?.to(`meeting:${targetId}`).emit('meeting:hands-updated', { hands });
    });

    socket.on('meeting:hand-lower', async (payload: { meetingId: string; userId?: string }) => {
      const targetId = socket.data.meetingId || payload?.meetingId;
      const callerId = socket.data.userId;
      if (!targetId || !callerId) return;

      const targetUserId = payload.userId || callerId;

      if (targetUserId !== callerId) {
        const meeting = targetId.match(/^[0-9a-fA-F]{24}$/)
          ? await Meeting.findById(targetId)
          : await Meeting.findOne({ meeting_join_code: targetId });

        if (meeting) {
          const isCreator = meeting.created_by.toString() === callerId;
          const participant = meeting.meeting_participants.find((p) => String(p.userId) === callerId);
          const isHost = participant?.participant_role === 'HOST';
          if (!isCreator && !isHost && !socket.data.isSuperAdmin) {
            return;
          }
        }
      }

      let hands = meetingRaisedHands.get(targetId) || [];
      if (targetUserId === 'all') {
        hands = [];
      } else if (targetUserId) {
        hands = hands.filter((h) => h.userId !== targetUserId);
      }
      meetingRaisedHands.set(targetId, hands);
      io?.to(`meeting:${targetId}`).emit('meeting:hands-updated', { hands });
    });

    /** Chat: can_use_chat is re-checked against the DB per message, so a host disable takes effect at once. */
    socket.on(
      'meeting:message',
      async (
        payload: { meetingId: string; text: string },
        ack?: (result: { ok: boolean; error?: string }) => void
      ) => {
        try {
          let joinedMeetingId = socket.data.meetingId ?? '';
          let meetingCode = (socket.data as Record<string, unknown>).meetingCode as string | undefined;

          if (!payload?.meetingId) {
            ack?.({ ok: false, error: 'Meeting ID is required' });
            return;
          }

          // If the socket reconnects or hasn't had socket.data.meetingId bound yet, check access and self-heal
          if (!joinedMeetingId || (payload.meetingId !== joinedMeetingId && payload.meetingId !== meetingCode)) {
            const meetingCandidate = payload.meetingId.match(/^[0-9a-fA-F]{24}$/)
              ? await Meeting.findById(payload.meetingId)
              : await Meeting.findOne({ meeting_join_code: payload.meetingId });

            if (meetingCandidate) {
              const currentUserId = socket.data.userId ?? '';
              const isSuper = Boolean(socket.data.isSuperAdmin);
              const isCreator = meetingCandidate.created_by.toString() === currentUserId;
              const isParticipant = meetingCandidate.meeting_participants.some(
                (p) => String(p.userId) === currentUserId
              );
              const isOrgMember =
                isSuper ||
                (socket.data.organizationId &&
                  meetingCandidate.organization_id.toString() === socket.data.organizationId);

              if (isSuper || isCreator || isParticipant || isOrgMember) {
                joinedMeetingId = meetingCandidate._id.toString();
                meetingCode = meetingCandidate.meeting_join_code;
                socket.data.meetingId = joinedMeetingId;
                (socket.data as Record<string, unknown>).meetingCode = meetingCode;
                await socket.join(`meeting:${joinedMeetingId}`);
              }
            }
          }

          if (!joinedMeetingId || (payload.meetingId !== joinedMeetingId && payload.meetingId !== meetingCode)) {
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

    socket.on('meeting:caption', (payload: {
      meetingId: string;
      id: string;
      speakerId: string;
      speakerName: string;
      text: string;
      isFinal: boolean;
      timestamp: number;
    }) => {
      const targetId = socket.data.meetingId || payload?.meetingId;
      if (!targetId || !payload?.text) return;

      // Broadcast real-time closed captions to all other participants in the meeting room
      socket.to(`meeting:${targetId}`).emit('meeting:caption', {
        id: payload.id,
        speakerId: payload.speakerId || socket.data.userId || 'participant',
        speakerName: payload.speakerName || 'Participant',
        text: payload.text,
        isFinal: Boolean(payload.isFinal),
        timestamp: payload.timestamp || Date.now()
      });

      // Maintain live transcript buffer: update the in-flight utterance turn or append new turn
      const turns = meetingLiveTranscripts.get(targetId) || [];
      const speakerId = payload.speakerId || socket.data.userId || 'participant';
      const speakerName = payload.speakerName || 'Participant';
      const lastTurn = turns[turns.length - 1];

      if (lastTurn && lastTurn.speakerId === speakerId && !payload.isFinal) {
        // Update in-progress turn text
        lastTurn.text = payload.text.trim();
        lastTurn.timestamp = payload.timestamp || Date.now();
      } else {
        // Utterance finalized or new speaker started
        turns.push({
          speakerId,
          speakerName,
          text: payload.text.trim(),
          timestamp: payload.timestamp || Date.now()
        });
      }
      meetingLiveTranscripts.set(targetId, turns);
    });

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
        const hands = meetingRaisedHands.get(meetingId);
        if (hands && hands.some((h) => h.userId === userId)) {
          const updated = hands.filter((h) => h.userId !== userId);
          meetingRaisedHands.set(meetingId, updated);
          io?.to(`meeting:${meetingId}`).emit('meeting:hands-updated', { hands: updated });
        }
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
