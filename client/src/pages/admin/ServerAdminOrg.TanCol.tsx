import React from 'react';
import type { Column } from '@/components/ui/data-table';
import { Building2, MapPin, Users, ChevronRight } from 'lucide-react';

export interface ServerOrg {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationLocation?: string;
  organizationDescription?: string;
  memberCount?: number;
  createdAt?: string;
}

export interface ServerOrgColumnsOptions {
  onView: (orgId: string) => void;
}

export const getServerOrgColumns = ({
  onView,
}: ServerOrgColumnsOptions): Column<ServerOrg>[] => {
  return [
    {
      id: 'organizationSlug',
      header: 'Org Code',
      width: '180px',
      cell: (org) => {
        const slug = org.organizationSlug || org.organizationId;
        return (
          <button
            type="button"
            onClick={() => onView(org.organizationId)}
            className="flex items-center gap-2 text-left group cursor-pointer hover:opacity-80 transition-opacity"
          >
            <Building2 size={14} className="text-emerald-500 shrink-0" />
            <span className="font-mono font-bold text-xs text-foreground group-hover:text-emerald-500 transition-colors tracking-tight">
              {slug}
            </span>
          </button>
        );
      },
    },
    {
      id: 'organizationName',
      header: 'Organization Name',
      minWidth: '220px',
      cell: (org) => {
        const name = org.organizationName || 'Unnamed Organization';
        const desc = org.organizationDescription;
        return (
          <button
            type="button"
            onClick={() => onView(org.organizationId)}
            className="flex flex-col min-w-0 text-left group cursor-pointer"
          >
            <span className="font-semibold text-xs text-foreground group-hover:text-emerald-500 transition-colors truncate">
              {name}
            </span>
            {desc && (
              <span className="text-[11px] text-muted-foreground truncate max-w-xs">{desc}</span>
            )}
          </button>
        );
      },
    },
    {
      id: 'organizationLocation',
      header: 'Location / Address',
      width: '180px',
      cell: (org) => {
        const loc = org.organizationLocation || '—';
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin size={13} className="text-muted-foreground/70 shrink-0" />
            <span className="truncate">{loc}</span>
          </div>
        );
      },
    },
    {
      id: 'memberCount',
      header: 'Members',
      width: '120px',
      align: 'center',
      cell: (org) => {
        const count = org.memberCount ?? 1;
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary text-foreground text-[11px] font-bold">
            <Users size={11} className="text-muted-foreground" />
            <span>{count}</span>
          </span>
        );
      },
    },
    {
      id: 'viewAction',
      header: '',
      width: '50px',
      align: 'right',
      cell: (org) => {
        return (
          <button
            type="button"
            onClick={() => onView(org.organizationId)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
            title="View Organization"
          >
            <ChevronRight size={15} />
          </button>
        );
      },
    },
  ];
};
