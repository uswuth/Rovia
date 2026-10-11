import * as React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, CheckCheck } from 'lucide-react';

export type MessageAlignment = 'left' | 'right';

interface MessageContextValue {
  alignment: MessageAlignment;
}

const MessageContext = React.createContext<MessageContextValue>({ alignment: 'left' });

export interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  alignment?: MessageAlignment;
}

export const Message = React.forwardRef<HTMLDivElement, MessageProps>(
  ({ className, alignment = 'left', children, ...props }, ref) => {
    return (
      <MessageContext.Provider value={{ alignment }}>
        <div
          ref={ref}
          className={cn(
            'flex gap-2.5 w-full text-xs transition-colors group/message',
            alignment === 'right' ? 'flex-row-reverse items-end justify-start' : 'flex-row items-start justify-start',
            className
          )}
          {...props}
        >
          {children}
        </div>
      </MessageContext.Provider>
    );
  }
);
Message.displayName = 'Message';

export interface MessageAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  name?: string;
  fallback?: string;
  onClick?: () => void;
  clickable?: boolean;
}

export const MessageAvatar = React.forwardRef<HTMLDivElement, MessageAvatarProps>(
  ({ className, src, name = 'User', fallback, onClick, clickable = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        onClick={clickable && onClick ? onClick : undefined}
        className={cn(
          'shrink-0 mt-0.5',
          clickable ? 'cursor-pointer hover:opacity-85 transition-opacity' : 'cursor-default',
          className
        )}
        {...props}
      >
        <Avatar className="size-6 text-[10px] shadow-2xs">
          {src && <AvatarImage src={src} alt={name} />}
          <AvatarFallback name={name} className="font-bold">
            {fallback || name.charAt(0).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }
);
MessageAvatar.displayName = 'MessageAvatar';

export type MessageBodyProps = React.HTMLAttributes<HTMLDivElement>;

export const MessageBody = React.forwardRef<HTMLDivElement, MessageBodyProps>(
  ({ className, children, ...props }, ref) => {
    const { alignment } = React.useContext(MessageContext);
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col max-w-[82%] min-w-0 space-y-1',
          alignment === 'right' ? 'items-end text-right' : 'items-start text-left',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
MessageBody.displayName = 'MessageBody';

export interface MessageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  sender?: string;
  timestamp?: string;
}

export const MessageHeader = React.forwardRef<HTMLDivElement, MessageHeaderProps>(
  ({ className, sender, timestamp, children, ...props }, ref) => {
    const { alignment } = React.useContext(MessageContext);
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-1.5 text-[11px] text-muted-foreground px-1 select-none',
          alignment === 'right' ? 'flex-row-reverse' : 'flex-row',
          className
        )}
        {...props}
      >
        {sender && <span className="font-semibold text-foreground truncate max-w-[120px]">{sender}</span>}
        {timestamp && <span className="text-[10px] text-muted-foreground/70">{timestamp}</span>}
        {children}
      </div>
    );
  }
);
MessageHeader.displayName = 'MessageHeader';

export interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bubble';
}

export const MessageContent = React.forwardRef<HTMLDivElement, MessageContentProps>(
  ({ className, children, ...props }, ref) => {
    const { alignment } = React.useContext(MessageContext);
    return (
      <div
        ref={ref}
        className={cn(
          'px-3 py-2 text-xs break-words [overflow-wrap:anywhere] break-all leading-relaxed',
          alignment === 'right'
            ? 'bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white rounded-2xl rounded-br-xs shadow-xs'
            : 'bg-muted text-foreground border border-border/60 rounded-2xl rounded-bl-xs shadow-2xs',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
MessageContent.displayName = 'MessageContent';

export type MessageFooterProps = React.HTMLAttributes<HTMLDivElement>;

export const MessageFooter = React.forwardRef<HTMLDivElement, MessageFooterProps>(
  ({ className, children, ...props }, ref) => {
    const { alignment } = React.useContext(MessageContext);
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-1 text-[10px] text-muted-foreground/80 px-1 select-none',
          alignment === 'right' ? 'justify-end' : 'justify-start',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
MessageFooter.displayName = 'MessageFooter';

export interface MessageStatusProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: 'sent' | 'delivered' | 'read';
  timestamp?: string;
}

export const MessageStatus: React.FC<MessageStatusProps> = ({
  status = 'delivered',
  timestamp,
  className,
}) => {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] text-muted-foreground/80', className)}>
      {timestamp && <span>{timestamp}</span>}
      {status === 'sent' && <Check size={11} className="text-muted-foreground/60" />}
      {status === 'delivered' && (
        <span className="inline-flex items-center gap-0.5 text-emerald-500 dark:text-emerald-400 font-medium">
          <CheckCheck size={12} />
          <span>Delivered</span>
        </span>
      )}
      {status === 'read' && (
        <span className="inline-flex items-center gap-0.5 text-blue-500 font-medium">
          <CheckCheck size={12} />
          <span>Read</span>
        </span>
      )}
    </span>
  );
};
