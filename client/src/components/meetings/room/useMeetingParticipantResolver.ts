import { useCallback } from 'react';
import { useOrganization } from '@/context/OrganizationContext';
import { getMemberId } from '@/components/members/member-utils';
import type { Meeting, MeetingParticipant, MeetingParticipantRaw } from '@/api/meeting/meeting.types';

export function useMeetingParticipantResolver({
  meeting,
  userId,
  userName,
  userEmail,
  userAvatarUrl,
}: {
  meeting?: Meeting;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userAvatarUrl?: string;
}) {
  const { members: orgMembers } = useOrganization();

  const getParticipantDisplayName = useCallback(
    (participant: { userId?: string; userName?: string; name?: string } | MeetingParticipant) => {
      const pId = participant.userId || '';
      if (pId === userId) return userName || 'You';

      const matchedMember = (orgMembers || []).find((m) => {
        const mId = getMemberId(m);
        return (
          mId === pId ||
          (m as unknown as Record<string, string>).id === pId ||
          (m as unknown as Record<string, string>)._id === pId
        );
      });

      if (matchedMember) {
        const mRaw = matchedMember as unknown as Record<string, string>;
        return mRaw.name || matchedMember.userName || mRaw.email || matchedMember.userEmail || 'Member';
      }

      const raw = participant as unknown as Record<string, string>;
      if (raw.userName || raw.name) {
        return raw.userName || raw.name;
      }

      return pId.length > 20 ? `Participant (${pId.slice(-4)})` : pId;
    },
    [orgMembers, userId, userName]
  );

  const getParticipantAvatar = useCallback(
    (participant: { userId?: string } | MeetingParticipant): string | undefined => {
      const pId = participant.userId || '';
      if (pId === userId) return userAvatarUrl;

      const raw = participant as unknown as Record<string, string>;
      if (raw.avatarUrl || raw.avatar) return raw.avatarUrl || raw.avatar;

      const matchedMember = (orgMembers || []).find((m) => {
        const mId = getMemberId(m);
        return (
          mId === pId ||
          (m as unknown as Record<string, string>).id === pId ||
          (m as unknown as Record<string, string>)._id === pId
        );
      });

      if (matchedMember) {
        const mRaw = matchedMember as unknown as Record<string, string>;
        return mRaw.avatarUrl || mRaw.avatar;
      }

      return undefined;
    },
    [orgMembers, userAvatarUrl, userId]
  );

  const getParticipantEmail = useCallback(
    (participant: { userId?: string }): string | undefined => {
      const pId = participant.userId || '';
      if (pId === userId) return userEmail;

      const matchedMember = (orgMembers || []).find((m) => {
        const mId = getMemberId(m);
        return (
          mId === pId ||
          (m as unknown as Record<string, string>).id === pId ||
          (m as unknown as Record<string, string>)._id === pId
        );
      });

      if (matchedMember) {
        const mRaw = matchedMember as unknown as Record<string, string>;
        return mRaw.email || mRaw.userEmail || (matchedMember as unknown as Record<string, string>).email;
      }

      const meetingPart = meeting?.participants?.find(
        (mp) => mp.userId === pId || (mp as unknown as MeetingParticipantRaw).user_id === pId
      );
      if (meetingPart) {
        const mpRaw = meetingPart as unknown as MeetingParticipantRaw & {
          email?: string;
          userEmail?: string;
          user?: { email?: string; userEmail?: string };
        };
        return (
          mpRaw.userEmail ||
          mpRaw.email ||
          mpRaw.user?.email ||
          mpRaw.user?.userEmail
        );
      }

      return undefined;
    },
    [meeting, orgMembers, userEmail, userId]
  );

  const getParticipantMeetingRole = useCallback(
    (participant: { userId?: string }): 'Host' | 'Moderator' | 'Member' => {
      const pId = participant.userId || '';
      const isCreator = meeting?.createdBy && meeting.createdBy === pId;
      const meetingPart = meeting?.participants?.find(
        (mp) => mp.userId === pId || (mp as unknown as MeetingParticipantRaw).user_id === pId
      );
      const role = (
        meetingPart?.participantRole ||
        (meetingPart as unknown as MeetingParticipantRaw)?.participant_role ||
        ''
      )
        .toString()
        .toUpperCase();

      if (isCreator || role === 'HOST') return 'Host';
      if (role === 'MODERATOR') return 'Moderator';
      return 'Member';
    },
    [meeting]
  );

  return {
    getParticipantDisplayName,
    getParticipantAvatar,
    getParticipantEmail,
    getParticipantMeetingRole,
  };
}
