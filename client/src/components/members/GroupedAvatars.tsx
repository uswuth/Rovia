import React from 'react';
import type { Member } from '@/types/member.types';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

import { normalizeMemberList } from './member-utils';

interface GroupedAvatarsProps {
  members?: (Member | string)[];
  maxDisplay?: number;
  onClick?: () => void;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
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
        <Users size={12} />
        <span>0</span>
      </div>
    );
  }

  const normalizedMembers = normalizeMemberList(members);
  const visible = normalizedMembers.slice(0, maxDisplay);
  const remainingCount = Math.max(0, normalizedMembers.length - maxDisplay);

  const avatarSizeClass =
    size === 'xs'
      ? 'size-5 text-[9px]'
      : size === 'sm'
      ? 'size-6 text-[10px]'
      : 'size-8 text-xs';

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
          const mName = item.userName || 'Member';
          return (
            <Tooltip key={item.userId || idx}>
              <TooltipTrigger asChild>
                <Avatar className={cn(avatarSizeClass, 'rounded-full ring-2 ring-background')}>
                  {item.avatarUrl ? (
                    <AvatarImage src={item.avatarUrl} alt={mName} />
                  ) : null}
                  <AvatarFallback name={mName} className="font-bold rounded-full select-none">
                    {(mName.charAt(0) || 'M').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-semibold">{mName}</p>
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
