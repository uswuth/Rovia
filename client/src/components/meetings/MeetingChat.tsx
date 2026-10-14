import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquare, SendHorizontal, BarChart3, Pin, ChevronDown, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal, ModalFooterCancel } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarColorByName } from '@/components/ui/avatar-colors';
import { MessageScroller } from '@/components/ui/message-scroller';
import { cn } from '@/lib/utils';
import { getMeetingSocket } from '@/api/meeting/meeting-socket';
import { useAuth } from '@/context/AuthContext';
import { useTimeFormat } from '@/context/TimeFormatContext';
import type { MeetingChatMessage } from '@/api/meeting/webrtc.types';
import type { MeetingParticipant } from '@/api/meeting/meeting.types';
import type { MeetingPoll } from '@/api/meeting/meeting-poll.api';

interface MeetingChatProps {
  meetingId: string;
  currentUserId: string;
  /** False when the host disabled chat for this member. */
  canPost: boolean;
  /** Failure sink — the room surfaces these as a toast. */
  onError: (message: string) => void;
  displayNameFor: (userId: string) => string;
  emailFor?: (userId: string) => string | undefined;
  meetingRoleFor?: (userId: string) => 'Host' | 'Moderator' | 'Member';
  participants?: MeetingParticipant[];
  canViewProfile?: boolean;
  canManage?: boolean;
  onOpenPolls?: () => void;
  activePoll?: MeetingPoll | null;
  onVotePoll?: (pollId: string, optionIds: string[]) => Promise<void>;
  onClosePoll?: (pollId: string) => Promise<void>;
  pollPending?: boolean;
  messages?: MeetingChatMessage[];
  setMessages?: React.Dispatch<React.SetStateAction<MeetingChatMessage[]>>;
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
  emailFor,
  meetingRoleFor,
  participants = [],
  canViewProfile = false,
  canManage = false,
  onOpenPolls,
  activePoll,
  onVotePoll,
  onClosePoll,
  pollPending = false,
  messages: propMessages,
  setMessages: propSetMessages,
}) => {
  const { user } = useAuth();
  const { formatTimeStr } = useTimeFormat();
  const [internalMessages, setInternalMessages] = useState<MeetingChatMessage[]>([]);
  const messages = propMessages ?? internalMessages;
  const setMessages = propSetMessages ?? setInternalMessages;
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<{
    userId: string;
    userName: string;
    email?: string;
    avatarUrl?: string;
    role?: string;
  } | null>(null);
  const [pinnedExpanded, setPinnedExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const scroll = () => {
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
    };
    requestAnimationFrame(scroll);
    window.setTimeout(scroll, 50);
  };

  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingTimeoutRef = useRef<number | null>(null);

  // Messages arrive only via the room broadcast, so every client (sender
  // included) renders from the same single source of truth.
  useEffect(() => {
    const socket = getMeetingSocket();
    const handleMessage = (message: MeetingChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.messageId === message.messageId)) return prev;
        return [...prev, message];
      });
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[message.from];
        return next;
      });
      scrollToBottom('smooth');
    };

    const handleTyping = (data: { userId: string; userName: string; isTyping: boolean }) => {
      if (!data.userId || data.userId === currentUserId) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (data.isTyping) {
          next[data.userId] = data.userName || displayNameFor(data.userId) || 'Someone';
        } else {
          delete next[data.userId];
        }
        return next;
      });
    };

    socket.on('meeting:message', handleMessage);
    socket.on('meeting:typing', handleTyping);

    return () => {
      socket.off('meeting:message', handleMessage);
      socket.off('meeting:typing', handleTyping);
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [meetingId, currentUserId, displayNameFor, setMessages]);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages.length]);

  const handleDraftChange = (newText: string) => {
    setDraft(newText);
    const socket = getMeetingSocket();
    const myName = displayNameFor(currentUserId);

    if (newText.trim().length > 0) {
      socket.emit('meeting:typing', { meetingId, isTyping: true, userName: myName });
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = window.setTimeout(() => {
        socket.emit('meeting:typing', { meetingId, isTyping: false, userName: myName });
      }, 1500);
    } else {
      socket.emit('meeting:typing', { meetingId, isTyping: false, userName: myName });
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    getMeetingSocket().emit('meeting:typing', { meetingId, isTyping: false });

    setSending(true);
    scrollToBottom('smooth');
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
        scrollToBottom('smooth');
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
    const role = meetingRoleFor
      ? meetingRoleFor(userId)
      : matched?.participantRole === 'HOST'
      ? 'Host'
      : matched?.participantRole === 'MODERATOR'
      ? 'Moderator'
      : 'Member';
    const email = emailFor ? emailFor(userId) : ((matched as unknown as Record<string, string | undefined>)?.userEmail || (matched as unknown as Record<string, string | undefined>)?.email);

    setSelectedProfileUser({
      userId,
      userName: name,
      email,
      avatarUrl,
      role,
    });
  };

  const getParticipantAvatar = (userId: string) => {
    const matched = participants.find((p) => p.userId === userId);
    return matched && 'avatarUrl' in matched ? (matched.avatarUrl as string) : undefined;
  };

  return (
    <div className="flex flex-col h-full min-h-0 w-full gap-2">
      {/* Pinned Active Poll Indexed Banner above Chat */}
      {activePoll && activePoll.pollStatus === 'OPEN' && (
        <div className="shrink-0 rounded-md border border-border/80 bg-card/95 shadow-xs overflow-hidden transition-all">
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border/60 text-xs">
            <div
              className="flex items-center gap-1.5 font-medium text-foreground min-w-0 flex-1 cursor-pointer select-none"
              onClick={() => setPinnedExpanded((v) => !v)}
            >
              <Pin size={13} className="shrink-0 text-emerald-500 rotate-45" />
              <span className="truncate text-xs font-semibold">{activePoll.pollQuestion}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <Badge
                tone="neutral"
                className="text-[10px] px-1.5 py-0 border-border/60 text-muted-foreground font-normal rounded-xs"
              >
                {activePoll.pollOptions.reduce((acc, o) => acc + o.voteCount, 0)} votes
              </Badge>
              <button
                type="button"
                onClick={() => setPinnedExpanded((v) => !v)}
                className="p-1 hover:bg-muted rounded-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Toggle pinned poll details"
              >
                <ChevronDown
                  size={14}
                  className={cn('transition-transform duration-200', pinnedExpanded && 'rotate-180')}
                />
              </button>
            </div>
          </div>

          {pinnedExpanded && (
            <div className="p-3 pb-3 space-y-2.5 bg-card/40 border-t border-border/40">
              <p className="text-xs font-medium text-foreground leading-snug">{activePoll.pollQuestion}</p>
              <ul className="space-y-1.5">
                {(() => {
                  const total = activePoll.pollOptions.reduce((acc, o) => acc + o.voteCount, 0);
                  const maxVotes = Math.max(0, ...activePoll.pollOptions.map((o) => o.voteCount));
                  return activePoll.pollOptions.map((opt) => {
                    const hasVoted = Boolean(opt.voterIds?.includes(currentUserId));
                    const pct = total === 0 ? 0 : Math.round((opt.voteCount / total) * 100);
                    const isLeader = opt.voteCount > 0 && opt.voteCount === maxVotes;
                    const isTrailing = opt.voteCount > 0 && opt.voteCount < maxVotes;

                    return (
                      <li key={opt.optionId}>
                        <button
                          type="button"
                          onClick={() => onVotePoll?.(activePoll.pollId, [opt.optionId])}
                          disabled={pollPending}
                          className={cn(
                            'relative w-full overflow-hidden rounded-xs border p-2 text-left text-xs transition-all cursor-pointer',
                            hasVoted
                              ? 'border-emerald-500/50 bg-emerald-500/5 font-medium'
                              : 'border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40'
                          )}
                        >
                          <div
                            className={cn(
                              'absolute inset-y-0 left-0 transition-all duration-300 rounded-xs pointer-events-none',
                              isLeader && 'bg-emerald-500/20 border-r border-emerald-400/60',
                              isTrailing && 'bg-zinc-500/25 dark:bg-zinc-700/50 border-r border-zinc-400/50 dark:border-zinc-500/60'
                            )}
                            style={{ width: `${pct}%` }}
                          />
                          <div className="relative flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 truncate text-xs text-foreground">
                              {hasVoted && <Check size={12} className="text-emerald-500 shrink-0" />}
                              <span className="truncate">{opt.optionText}</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                              {opt.voteCount} ({pct}%)
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  });
                })()}
              </ul>
              <div className="flex items-center justify-between pt-1 text-[11px]">
                {canManage && onOpenPolls && (
                  <button
                    type="button"
                    onClick={onOpenPolls}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                  >
                    View in Polls tab →
                  </button>
                )}
                {canManage && onClosePoll && (
                  <Button
                    variant="destructive"
                    size="xs"
                    className="h-6 px-2 text-[10px] cursor-pointer ml-auto rounded-xs"
                    onClick={() => onClosePoll(activePoll.pollId)}
                    disabled={pollPending}
                  >
                    Close poll
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages Transcript with MessageScroller */}
      <MessageScroller.Provider autoScroll={true} defaultScrollPosition="end">
        <MessageScroller.Root className="relative flex-1 min-h-0">
          <MessageScroller.Viewport className="flex-1 min-h-0 pr-1 no-scrollbar overflow-x-hidden">
            <MessageScroller.Content className="space-y-3 min-h-full pb-6 px-2">
              {messages.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No messages yet"
                  description="Send a message to start the conversation."
                />
              ) : (
                messages.map((message) => {
                  const isMe = message.from === currentUserId;
                  const senderDisplayName = isMe ? 'You' : displayNameFor(message.from);
                  const realUserName = isMe ? (user?.userName || 'User') : displayNameFor(message.from);
                  const realInitial = (realUserName === 'You' ? (user?.userName || 'U') : realUserName).trim().charAt(0).toUpperCase() || 'U';
                  const avatarSrc = isMe ? (user?.avatarUrl || getParticipantAvatar(message.from)) : getParticipantAvatar(message.from);
                  const formattedTime = formatTimeStr(message.at);

                  return (
                    <MessageScroller.Item
                      key={message.messageId}
                      messageId={message.messageId}
                      scrollAnchor={isMe}
                    >
                      <div
                        className={cn(
                          'flex flex-col w-full text-xs transition-colors group/message',
                          isMe ? 'items-end' : 'items-start'
                        )}
                      >
                        {/* Message Bubble */}
                        <div
                          className={cn(
                            'px-3.5 pt-2 pb-1.5 text-xs break-words [overflow-wrap:anywhere] leading-relaxed max-w-[85%]',
                            isMe
                              ? 'bg-accent text-accent-foreground border border-accent/20 rounded-2xl rounded-tr-xs shadow-xs font-normal'
                              : 'bg-muted/90 dark:bg-zinc-800/90 text-foreground border border-border/50 rounded-2xl rounded-tl-xs shadow-2xs'
                          )}
                        >
                          <div className="whitespace-pre-wrap">{message.text}</div>

                          {/* Reserved Bottom Line inside bubble: Time & Delivery Status */}
                          <div
                            className={cn(
                              'flex items-center gap-1 mt-1 text-[10px] select-none',
                              isMe ? 'justify-end text-accent-foreground/80' : 'justify-start text-muted-foreground/75'
                            )}
                          >
                            <span>{formattedTime}</span>
                            {isMe && <CheckCheck size={12} className="text-accent-foreground/90" />}
                          </div>
                        </div>

                        {/* Message End Bar (Profile Avatar & Name placed beneath the bubble with directional depth offset) */}
                        {isMe ? (
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground/80 justify-end select-none pr-0.5 translate-x-2">
                            <span className="font-medium text-muted-foreground/90 truncate max-w-[120px]">{senderDisplayName}</span>
                            <div
                              onClick={canViewProfile ? () => handleAvatarClick(message.from) : undefined}
                              className={cn(canViewProfile && 'cursor-pointer hover:opacity-85 transition-opacity')}
                              title={canViewProfile ? 'View Your Profile' : undefined}
                            >
                              <Avatar className="size-5 text-[8px] shadow-2xs ring-1 ring-border/50 select-none">
                                {avatarSrc && <AvatarImage src={avatarSrc} alt={realUserName} className="object-cover" />}
                                <AvatarFallback name={realUserName} className={cn("font-bold text-[8px]", getAvatarColorByName(realUserName))}>
                                  {realInitial}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground/80 justify-start select-none pl-0.5 -translate-x-2">
                            <div
                              onClick={canViewProfile ? () => handleAvatarClick(message.from) : undefined}
                              className={cn(canViewProfile && 'cursor-pointer hover:opacity-85 transition-opacity')}
                              title={canViewProfile ? `View ${senderDisplayName}'s Profile` : undefined}
                            >
                              <Avatar className="size-5 text-[8px] shadow-2xs ring-1 ring-border/50 select-none">
                                {avatarSrc && <AvatarImage src={avatarSrc} alt={realUserName} className="object-cover" />}
                                <AvatarFallback name={realUserName} className={cn("font-bold text-[8px]", getAvatarColorByName(realUserName))}>
                                  {realInitial}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <span className="font-semibold text-foreground/90 truncate max-w-[120px]">{senderDisplayName}</span>
                          </div>
                        )}
                      </div>
                    </MessageScroller.Item>
                  );
                })
              )}
              <div ref={bottomRef} className="h-px shrink-0" aria-hidden="true" />
            </MessageScroller.Content>
          </MessageScroller.Viewport>
          <MessageScroller.Button />
        </MessageScroller.Root>
      </MessageScroller.Provider>

      {/* Chat Bottom Controls */}
      <div className="shrink-0 pt-1 pb-1 mt-auto flex flex-col justify-end">
        {/* Real-time Typing Indicator with official shadcn shimmer */}
        {Object.keys(typingUsers).length > 0 && (
          <div className="px-1.5 pb-1 select-none">
            <span className="shimmer text-[11px] font-normal text-muted-foreground select-none">
              {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing…
            </span>
          </div>
        )}

        {canPost ? (
          <form onSubmit={send} className="w-full">
            <div className="flex items-center gap-2 w-full">
              {canManage && onOpenPolls && (
                <button
                  type="button"
                  onClick={onOpenPolls}
                  className="flex size-9 shrink-0 items-center justify-center rounded-xs border border-border bg-card text-muted-foreground hover:text-emerald-500 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-colors cursor-pointer shadow-xs active:scale-95"
                  title="Create or Manage In-Meeting Polls"
                >
                  <BarChart3 size={16} className="text-emerald-500" />
                </button>
              )}

              <Input
                type="text"
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                placeholder="Type a message..."
                maxLength={MAX_CHARS}
                disabled={sending}
                className="flex-1 min-w-0 h-9 px-3.5 text-xs"
                aria-label="Chat message"
              />

              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer active:scale-95 disabled:opacity-25 disabled:pointer-events-none transition-all"
                title="Send Message"
              >
                <SendHorizontal size={15} className="translate-x-[0.5px]" />
              </button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2 italic">
            Chat is disabled for you in this meeting.
          </p>
        )}
      </div>

      {/* Member Profile Modal */}
      {selectedProfileUser && (
        <Modal
          open={Boolean(selectedProfileUser)}
          onClose={() => setSelectedProfileUser(null)}
          title="Member Profile"
          className="max-w-sm"
        >
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Avatar className="size-12 ring-2 ring-border">
                {selectedProfileUser.avatarUrl && (
                  <AvatarImage src={selectedProfileUser.avatarUrl} alt={selectedProfileUser.userName} />
                )}
                <AvatarFallback name={selectedProfileUser.userName} className={cn("text-sm font-bold", getAvatarColorByName(selectedProfileUser.userName))}>
                  {selectedProfileUser.userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-foreground truncate">{selectedProfileUser.userName}</h3>
                {selectedProfileUser.email && (
                  <p className="text-xs text-muted-foreground truncate">{selectedProfileUser.email}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge
                    tone={selectedProfileUser.role === 'Host' ? 'accent' : 'neutral'}
                    className="text-[10px] py-0 px-1.5 font-semibold"
                  >
                    {selectedProfileUser.role || 'Member'}
                  </Badge>
                </div>
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