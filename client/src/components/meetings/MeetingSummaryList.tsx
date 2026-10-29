import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTimeFormat } from '@/context/TimeFormatContext';
import type { RecordingWithAiStatus } from '@/api/recording/recording.types';
import type { Meeting } from '@/api/meeting/meeting.types';

export interface MeetingSummaryListItemProps {
  recording: RecordingWithAiStatus;
  meeting?: Meeting;
  summaryText?: string;
  keyPointsCount?: number;
  actionItemsCount?: number;
}

/**
 * One generated summary as a compact, clickable list item.
 *
 * The meeting list is the requested replacement for "only show the last
 * generated summary": every recording that reached READY keeps a card here.
 */
export const MeetingSummaryListItem: React.FC<MeetingSummaryListItemProps> = ({
  recording,
  meeting,
  summaryText,
  keyPointsCount = 0,
  actionItemsCount = 0,
}) => {
  const { formatDateTimeStr } = useTimeFormat();
  const meetingTitle = meeting?.meetingTitle ?? 'Untitled meeting';
  const meetingId = recording.meetingId ?? '';
  const dateStr = recording.createdAt ? formatDateTimeStr(new Date(recording.createdAt)) : '—';
  const joinedCode = meeting?.meetingJoinCode ?? '';

  return (
    <Link
      to={meetingId ? `/meetings/${meetingId}/summary` : '#'}
      className="block w-full"
    >
      <Card className="flex flex-col transition hover:bg-muted/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold text-foreground">{meetingTitle}</CardTitle>
          <Badge tone="neutral" className="text-xxxs">
            {recording.recordingStatus}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-mono">{dateStr}</span>
            <span className="text-muted-foreground">•</span>
            <span className="font-mono">{meetingId?.slice(0, 8)}</span>
          </div>
          {joinedCode && (
            <div className="font-mono text-[10px] text-muted-foreground">{joinedCode}</div>
          )}
          {summaryText ? (
            <p className="line-clamp-3 text-foreground">{summaryText}</p>
          ) : (
            <p className="text-muted-foreground">No summary extracted yet.</p>
          )}
          <div className="flex gap-3 text-[11px] font-medium text-muted-foreground">
            <span>{keyPointsCount} keypoints</span>
            <span>{actionItemsCount} actions</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
