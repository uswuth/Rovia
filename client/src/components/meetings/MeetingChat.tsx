import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/EmptyState';
import { getMeetingSocket } from '@/api/meeting/meeting-socket';
import type { MeetingChatMessage } from '@/api/meeting/webrtc.types';

interface MeetingChatProps {
  meetingId: string;
  currentUserId: string;
  /** False when the host disabled chat for this member. */
  canPost: boolean;
  /** Failure sink — the room surfaces these as a toast. */
  onError: (message: string) => void;
  displayNameFor: (userId: string) => string;
}

/** Mirrors MAX_CHAT_MESSAGE_CHARS on the server. */
const MAX_CHARS = 2000;
/** No ack within this window means the socket is dead — fail loudly. */
const ACK_TIMEOUT_MS = 8000;

export const MeetingChat = ({
  meetingId,
  currentUserId,
  canPost,
  onError,
  displayNameFor,
}: MeetingChatProps) => {
  const [messages, setMessages] = useState<MeetingChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Messages arrive only via the room broadcast, so every client (sender
  // included) renders from the same single source of truth.
  useEffect(() => {
    const socket = getMeetingSocket();
    const handleMessage = (message: MeetingChatMessage) => {
      if (message.meetingId !== meetingId) return;
      setMessages((prev) => [...prev, message]);
    };
    socket.on('meeting:message', handleMessage);
    return () => {
      socket.off('meeting:message', handleMessage);
    };
  }, [meetingId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      setSending(false);
      onError('The server did not confirm the message — check your connection.');
    }, ACK_TIMEOUT_MS);

    getMeetingSocket().emit('meeting:message', { meetingId, text }, (result) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      setSending(false);
      if (result?.ok) {
        setDraft('');
      } else {
        onError(result?.error ?? 'Message could not be sent');
      }
    });
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 min-h-[260px]">
        {messages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description="Chat messages are visible to everyone on the meeting roster."
          />
        ) : (
          <ul className="space-y-2">
            {messages.map((message) => (
              <li key={message.messageId} className="rounded-md border border-border bg-card p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {message.from === currentUserId ? 'You' : displayNameFor(message.from)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(message.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground break-words whitespace-pre-wrap">
                  {message.text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canPost ? (
        <form onSubmit={send} className="flex items-center gap-2 pt-2 border-t border-border">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message..."
            maxLength={MAX_CHARS}
            className="flex-1 text-xs"
            aria-label="Chat message"
          />
          <Button
            type="submit"
            size="sm"
            disabled={sending || !draft.trim()}
            className="gap-1 text-xs font-semibold px-3"
          >
            <Send size={13} />
            <span>Send</span>
          </Button>
        </form>
      ) : (
        <p className="pt-2 border-t border-border text-xs text-muted-foreground">
          Chat is disabled for you in this meeting.
        </p>
      )}
    </div>
  );
};