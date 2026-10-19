import React from 'react';
import { PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface MeetingEndedModalProps {
  open: boolean;
  onReturnToMeetings: () => void;
  onGoToProjects: () => void;
}

export const MeetingEndedModal: React.FC<MeetingEndedModalProps> = ({
  open,
  onReturnToMeetings,
  onGoToProjects,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xs border border-border bg-card p-6 shadow-2xl space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <PhoneOff size={24} />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">Meeting Ended</h3>
          <p className="text-xs text-muted-foreground">
            The host has ended this meeting for everyone.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            variant="default"
            size="sm"
            onClick={onReturnToMeetings}
            className="w-full cursor-pointer"
          >
            Return to Meetings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onGoToProjects}
            className="w-full cursor-pointer"
          >
            Go to Projects
          </Button>
        </div>
      </div>
    </div>
  );
};
