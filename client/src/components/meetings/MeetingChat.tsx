import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquare, Send, BarChart3, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal, ModalFooterCancel } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Message,
  MessageAvatar,
  MessageBody,
  MessageHeader,
  MessageContent,
  MessageFooter,
  MessageStatus,
} from '@/components/ui/message';
import { getMeetingSocket } from '@/api/meeting/meeting-socket';
import type { MeetingChatMessage } from '@/api/meeting/webrtc.types';
import type { MeetingParticipant } from '@/api/meeting/meeting.types';

interface MeetingChatProps {
  meetingId: string;
  currentUserId: string;
  /** False when the host disabled chat for this member. */
  canPost: boolean;
  /** Failure sink — the room surfaces these as a toast. */
  onError: (message: string) => void;
  displayNameFor: (userId: string) => string;
  participants?: MeetingParticipant[];
  /** Only true for actual SuperAdmin / Admin (not regular members even if meeting host) */
  canViewProfile?: boolean;
  onOpenPolls?: () => void;
}

/** Mirrors MAX_CHAT_MESSAGE_CHARS on the server. */
const MAX_CHARS = 2000;
/** No ack within this window means the socket is dead — fail loudly. */
const ACK_TIMEOUT_MS = 8000;

export const MeetingChat: React.FC<MeetingChatProps> = ({
  meetingId,
  currentUserId,
  canPost,
  onError,
  displayNameFor,
  participants = [],
  canViewProfile = false,
  onOpenPolls,
}) => {
  const [messages, setMessages] = useState<MeetingChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<{
    userId: string;
    userName: string;
    avatarUrl?: string;
    role?: string;
  } | null>(null);
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
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
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

  const handleAvatarClick = (userId: string) => {
    if (!canViewProfile) return;
    const matched = participants.find((p) => p.userId === userId);
    const name = displayNameFor(userId);
    const avatarUrl = matched && 'avatarUrl' in matched ? (matched.avatarUrl as string) : undefined;
    const role = matched && 'participantRole' in matched ? (matched.participantRole as string) : 'Member';
    setSelectedProfileUser({
      userId,
      userName: name,
      avatarUrl,
      role,
    });
  };

  const getParticipantAvatar = (userId: string) => {
    const matched = participants.find((p) => p.userId === userId);
    return matched && 'avatarUrl' in matched ? (matched.avatarUrl as string) : undefined;
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Messages Scroll Area */}
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-3 min-h-[260px] pr-1">
        {messages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description="Chat messages are visible to everyone on the meeting roster."
          />
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isMe = message.from === currentUserId;
              const senderName = isMe ? 'You' : displayNameFor(message.from);
              const avatarSrc = getParticipantAvatar(message.from);
              const formattedTime = new Date(message.at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <Message key={message.messageId} alignment={isMe ? 'right' : 'left'}>
                  <MessageAvatar
                    name={senderName}
                    src={avatarSrc}
                    clickable={canViewProfile}
                    onClick={() => handleAvatarClick(message.from)}
                    title={canViewProfile ? `View ${senderName}'s Profile` : undefined}
                  />
                  <MessageBody>
                    <MessageHeader sender={senderName} timestamp={formattedTime} />
                    <MessageContent>{message.text}</MessageContent>
                    {isMe && (
                      <MessageFooter>
                        <MessageStatus status="delivered" />
                      </MessageFooter>
                    )}
                  </MessageBody>
                </Message>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat Bottom Controls */}
      <div className="pt-2 border-t border-border space-y-2">
        {canPost ? (
          <form onSubmit={send} className="space-y-2">
            <div className="relative flex items-center w-full">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message..."
                maxLength={MAX_CHARS}
                className="w-full text-xs pr-10 h-9 bg-background focus:ring-1 focus:ring-emerald-500"
                aria-label="Chat message"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="absolute right-1.5 p-1 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
                title="Send Message"
              >
                <Send size={15} />
              </button>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
              <div className="flex items-center gap-1.5">
                {onOpenPolls && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={onOpenPolls}
                    className="h-6 gap-1 px-2 text-[11px] font-medium text-foreground hover:bg-accent cursor-pointer"
                    title="Open In-Meeting Polls"
                  >
                    <BarChart3 size={12} className="text-emerald-500 shrink-0" />
                    <span>Poll</span>
                  </Button>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground/60">
                {draft.length > 0 ? `${draft.length}/${MAX_CHARS}` : 'Press Enter to send'}
              </span>
            </div>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2 italic">
            Chat is disabled for you in this meeting.
          </p>
        )}
      </div>

      {/* Member Profile Modal for SuperAdmin and Admin */}
      {selectedProfileUser && (
        <Modal
          open={Boolean(selectedProfileUser)}
          onClose={() => setSelectedProfileUser(null)}
          title="Member Profile"
          description="Participant details visible to Administrators."
          className="max-w-sm"
        >
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Avatar className="size-12 ring-2 ring-border">
                {selectedProfileUser.avatarUrl && (
                  <AvatarImage src={selectedProfileUser.avatarUrl} alt={selectedProfileUser.userName} />
                )}
                <AvatarFallback name={selectedProfileUser.userName} className="text-sm font-bold">
                  {selectedProfileUser.userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-foreground truncate">{selectedProfileUser.userName}</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge tone="neutral" className="text-[10px] py-0 px-1.5 font-semibold">
                    {selectedProfileUser.role || 'Member'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <UserIcon size={12} />
                  User ID:
                </span>
                <span className="font-mono text-[11px] text-foreground truncate max-w-[150px]">
                  {selectedProfileUser.userId}
                </span>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-3">
            <ModalFooterCancel onClick={() => setSelectedProfileUser(null)} />
          </div>
        </Modal>
      )}
    </div>
  );
};