import { useEffect } from 'react';
import { getMeetingSocket } from '@/api/meeting/meeting-socket';
import { queryKeys } from '@/api/queryClient';
import type { QueryClient } from '@tanstack/react-query';
import type { MeetingChatMessage, RaisedHand } from '@/api/meeting/webrtc.types';

export function useMeetingSocketEvents({
  meetingId,
  isAuthenticated,
  queryClient,
  userId,
  refetchMeeting,
  refetchQuestions,
  onMeetingEnded,
  onParticipantMutedByHost,
  onParticipantCameraOffByHost,
  onChatMessageReceived,
  onHandsUpdated,
}: {
  meetingId: string;
  isAuthenticated: boolean;
  queryClient: QueryClient;
  userId?: string;
  refetchMeeting: () => void;
  refetchQuestions: () => void;
  onMeetingEnded: () => void;
  onParticipantMutedByHost: () => void;
  onParticipantCameraOffByHost: () => void;
  onChatMessageReceived: (message: MeetingChatMessage) => void;
  onHandsUpdated: (hands: RaisedHand[]) => void;
}) {
  useEffect(() => {
    if (!meetingId || !isAuthenticated) return;
    const s = getMeetingSocket();

    const handleEnded = () => {
      onMeetingEnded();
    };

    const handlePollUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meetings.polls(meetingId) });
    };

    const handleQuestionUpdated = () => {
      refetchQuestions();
      void queryClient.invalidateQueries({ queryKey: queryKeys.meetings.questions(meetingId) });
    };

    const handleParticipantUpdated = (data: {
      meetingId: string;
      participantId: string;
      permissions?: Record<string, boolean>;
    }) => {
      refetchMeeting();
      if (data.participantId === userId) {
        if (data.permissions?.canSendAudio === false) {
          onParticipantMutedByHost();
        }
        if (data.permissions?.canSendVideo === false) {
          onParticipantCameraOffByHost();
        }
      }
    };

    const handleMessage = (message: MeetingChatMessage) => {
      onChatMessageReceived(message);
    };

    const handleHands = (data: { hands: RaisedHand[] }) => {
      onHandsUpdated(data?.hands || []);
    };

    s.on('meeting:ended', handleEnded);
    s.on('meeting:poll-updated', handlePollUpdated);
    s.on('meeting:question-updated', handleQuestionUpdated);
    s.on('meeting:participant-updated', handleParticipantUpdated);
    s.on('meeting:message', handleMessage);
    s.on('meeting:hands-updated', handleHands);

    return () => {
      s.off('meeting:ended', handleEnded);
      s.off('meeting:poll-updated', handlePollUpdated);
      s.off('meeting:question-updated', handleQuestionUpdated);
      s.off('meeting:participant-updated', handleParticipantUpdated);
      s.off('meeting:message', handleMessage);
      s.off('meeting:hands-updated', handleHands);
    };
  }, [
    meetingId,
    isAuthenticated,
    queryClient,
    userId,
    refetchMeeting,
    refetchQuestions,
    onMeetingEnded,
    onParticipantMutedByHost,
    onParticipantCameraOffByHost,
    onChatMessageReceived,
    onHandsUpdated,
  ]);
}
