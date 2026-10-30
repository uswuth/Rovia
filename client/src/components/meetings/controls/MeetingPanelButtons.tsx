import React from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { PANELS, type PanelKey } from '../meetingPanels';

export interface MeetingPanelButtonsProps {
  panel?: PanelKey | null;
  onSelectPanel: (panel: PanelKey | null) => void;
}

export const MeetingPanelButtons: React.FC<MeetingPanelButtonsProps> = ({
  panel,
  onSelectPanel,
}) => {
  return (
    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
      {PANELS.filter((item) => item.key !== 'people').map((item) => (
        <Tooltip key={item.key} content={item.label} side="top">
          <button
            type="button"
            onClick={() => onSelectPanel(panel === item.key ? null : item.key)}
            className={`flex size-7 sm:size-9 w-7 sm:w-9 h-7 sm:h-9 min-w-7 sm:min-w-9 min-h-7 sm:min-h-9 shrink-0 aspect-square items-center justify-center rounded-full border transition-colors cursor-pointer ${
              panel === item.key
                ? 'bg-primary/15 text-primary border-primary/40 font-bold'
                : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <item.icon size={15} className="sm:w-[18px] sm:h-[18px]" />
          </button>
        </Tooltip>
      ))}
    </div>
  );
};
