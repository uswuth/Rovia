import React from 'react';
import type { Member } from '@/types/member.types';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
  getAvatarColorByName,
} from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GroupedAvatarsProps {
  members?: (Member | string | Record<string, unknown>)[];
  maxDisplay?: number;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md';
}

export const GroupedAvatars: React.FC<GroupedAvatarsProps> = ({
  members = [],
  maxDisplay = 3,
  onClick,
  className = '',
  size = 'sm',
}) => {
  if (!members || members.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 italic font-mono">
        <Users size={13} />
        <span>0</span>
      </div>
    );
  }

  const normalizeItem = (item: Member | string | Record<string, unknown>) => {
    if (typeof item === 'string') {
      return { id: item, name: item, email: '', avatarUrl: '' };
    }
    const obj = item as Record<string, unknown>;
    const id = (obj.userId || obj._id || obj.id || '') as string;
    const name = (obj.userName || obj.name || obj.userEmail || id || 'Member') as string;
    const email = (obj.userEmail || obj.email || '') as string;
    const avatarUrl = (obj.avatarUrl || obj.avatar || '') as string;
    return { id, name, email, avatarUrl };
  };

  const normalized = members.map(normalizeItem);
  const visible = normalized.slice(0, maxDisplay);
  const remainingCount = Math.max(0, normalized.length - maxDisplay);

  const avatarSizeClass = size === 'sm' ? 'size-7 text-[11px]' : 'size-8 text-xs';

  return (
    <div
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={cn(
        'inline-flex items-center gap-1.5 group rounded-full transition-all p-0.5',
        onClick && 'cursor-pointer hover:opacity-85',
        className
      )}
    >
      <AvatarGroup>
        {visible.map((item, idx) => {
          const colorClass = getAvatarColorByName(item.name);
          return (
            <Tooltip key={item.id || idx}>
              <TooltipTrigger asChild>
                <Avatar className={cn(avatarSizeClass, 'rounded-full ring-2 ring-background')}>
                  {item.avatarUrl ? (
                    <AvatarImage src={item.avatarUrl} alt={item.name} />
                  ) : null}
                  <AvatarFallback className={cn(colorClass, 'font-bold rounded-full select-none')}>
                    {(item.name.charAt(0) || 'M').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-semibold">{item.name}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {remainingCount > 0 && (
          <AvatarGroupCount className={cn(avatarSizeClass, 'bg-zinc-800 text-zinc-100 font-bold rounded-full font-mono ring-2 ring-background')}>
            +{remainingCount}
          </AvatarGroupCount>
        )}
      </AvatarGroup>
    </div>
  );
};
