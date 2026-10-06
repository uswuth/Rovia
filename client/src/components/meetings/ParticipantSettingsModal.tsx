import { useState } from 'react';
import { Modal, ModalFooterCancel } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import type { MeetingParticipant } from '@/api/meeting/meeting.types';

export interface ParticipantPermissions {
  canSendAudio: boolean;
  canSendVideo: boolean;
  canShareScreen: boolean;
  canUseChat: boolean;
}

interface ParticipantSettingsModalProps {
  participant: MeetingParticipant | null;
  onClose: () => void;
  onSave: (participantId: string, permissions: ParticipantPermissions) => Promise<void>;
  pending: boolean;
  errorMessage?: string;
}

const PERMISSIONS: ReadonlyArray<{
  key: keyof ParticipantPermissions;
  label: string;
  hint: string;
}> = [
  { key: 'canSendAudio', label: 'Microphone', hint: 'Allow this member to speak' },
  { key: 'canSendVideo', label: 'Camera', hint: 'Allow this member to send video' },
  { key: 'canShareScreen', label: 'Screen share', hint: 'Allow this member to present' },
  { key: 'canUseChat', label: 'Chat, Q&A and polls', hint: 'Allow this member to post anything' },
];

const permissionsOf = (participant: MeetingParticipant): ParticipantPermissions => ({
  canSendAudio: participant.canSendAudio,
  canSendVideo: participant.canSendVideo,
  canShareScreen: participant.canShareScreen,
  canUseChat: participant.canUseChat,
});

const allGranted: ParticipantPermissions = {
  canSendAudio: true,
  canSendVideo: true,
  canShareScreen: true,
  canUseChat: true,
};

/**
 * Per-member capability toggles. Chat also gates questions, answers and votes
 * server-side, so the label says so rather than implying it is chat only.
 *
 * State is seeded from props, and the parent keys this component by participant
 * id so switching members remounts it with fresh values. Syncing through an
 * effect instead is rejected by the project's own React rules.
 */
export const ParticipantSettingsModal = ({
  participant,
  onClose,
  onSave,
  pending,
  errorMessage,
}: ParticipantSettingsModalProps) => {
  const [values, setValues] = useState<ParticipantPermissions>(() =>
    participant ? permissionsOf(participant) : allGranted
  );

  if (!participant) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Participant permissions"
      description={`${participant.userId} · ${participant.participantRole.toLowerCase()}`}
      footer={
        <>
          <ModalFooterCancel onClick={onClose} disabled={pending} />
          <Button
            type="button"
            disabled={pending}
            onClick={() => onSave(participant.userId, values)}
          >
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {PERMISSIONS.map((permission) => (
          <label
            key={permission.key}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5"
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              checked={values[permission.key]}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, [permission.key]: event.target.checked }))
              }
            />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-foreground">{permission.label}</span>
              <span className="block text-xs text-muted-foreground">{permission.hint}</span>
            </span>
          </label>
        ))}

        {errorMessage && (
          <p role="alert" className="text-xs text-destructive">
            {errorMessage}
          </p>
        )}
      </div>
    </Modal>
  );
};
