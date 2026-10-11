import React from 'react';
import { Button } from '@/components/ui/button';

export interface MeetingLeaveModalProps {
  open: boolean;
  isCreatorOrHost: boolean;
  isLeaving: boolean;
  isEnding: boolean;
  onCancel: () => void;
  onConfirmLeave: () => void;
  onConfirmEndMeeting: () => void;
}

/** Google Meet style dialog allowing host to either leave or end call for all, and attendees to leave */
export const MeetingLeaveModal: React.FC<MeetingLeaveModalProps> = ({
  open,
  isCreatorOrHost,
  isLeaving,
  isEnding,
  onCancel,
  onConfirmLeave,
  onConfirmEndMeeting,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
        <h3 className="text-base font-bold text-foreground">
          {isCreatorOrHost ? 'Leave or End Meeting' : 'Leave Call?'}
        </h3>

        {isCreatorOrHost ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              As the meeting organizer, you can leave the room while keeping it active for others, or end the meeting for everyone:
            </p>

            <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Just leave the call</span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isLeaving || isEnding}
                  onClick={onConfirmLeave}
                  className="cursor-pointer text-xs"
                >
                  {isLeaving ? 'Leaving…' : 'Leave Call'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Others can continue the meeting and collaborate until it is ended.
              </p>
            </div>

            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-destructive">End call for everyone</span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isLeaving || isEnding}
                  onClick={onConfirmEndMeeting}
                  className="cursor-pointer text-xs"
                >
                  {isEnding ? 'Ending…' : 'End Call'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Immediately ejects all participants and marks this meeting as ended.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Are you sure you want to leave the call? You can rejoin anytime using the meeting link.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isLeaving || isEnding}
            onClick={onCancel}
          >
            Cancel
          </Button>
          {!isCreatorOrHost && (
            <Button
              variant="destructive"
              size="sm"
              disabled={isLeaving}
              onClick={onConfirmLeave}
            >
              {isLeaving ? 'Leaving…' : 'Leave Call'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
