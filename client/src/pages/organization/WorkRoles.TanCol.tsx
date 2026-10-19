import { Tag, Edit2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeBadge } from '@/components/ui/CodeBadge';
import type { Column } from '@/components/ui/data-table';
import type { WorkRoleItem } from '@/api/work-roles/work-roles.api';

export interface WorkRoleColumnsOptions {
  canManage: boolean;
  onEdit: (role: WorkRoleItem) => void;
  onDelete: (roleId: string) => void;
}

export const getWorkRoleColumns = ({
  canManage,
  onEdit,
  onDelete,
}: WorkRoleColumnsOptions): Column<WorkRoleItem>[] => {
  return [
    {
      id: 'roleCode',
      header: 'Role Code',
      width: '120px',
      minWidth: '110px',
      cell: (r) => (
        <CodeBadge code={r.roleCode} fallback="WR-N/A" />
      ),
    },
    {
      id: 'roleName',
      header: 'Role Name',
      width: '200px',
      minWidth: '180px',
      cell: (r) => (
        <span className="font-semibold text-foreground text-sm leading-snug">
          {r.roleName || ''}
        </span>
      ),
    },
    {
      id: 'tagName',
      header: 'Tag / Category',
      width: '150px',
      minWidth: '130px',
      cell: (r) => {
        return r.tagName ? (
          <Badge tone="neutral" className="gap-1 font-mono text-xs">
            <Tag size={11} />
            <span>{r.tagName}</span>
          </Badge>
        ) : (
          <span className="text-xs italic text-muted-foreground/50">N/A</span>
        );
      },
    },
    {
      id: 'description',
      header: 'Description',
      width: '300px',
      minWidth: '220px',
      cell: (r) => {
        return r.description ? (
          <span className="text-xs text-muted-foreground line-clamp-2 block">{r.description}</span>
        ) : (
          <span className="text-xs italic text-muted-foreground/50">No description</span>
        );
      },
    },
    {
      id: 'createdAt',
      header: 'Created At',
      width: '120px',
      minWidth: '110px',
      cell: (r) => {
        const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A';
        return <span className="text-xs text-muted-foreground font-mono">{date}</span>;
      },
    },
    {
      id: 'updatedAt',
      header: 'Updated At',
      width: '120px',
      minWidth: '110px',
      cell: (r) => {
        const date = r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : 'N/A';
        return <span className="text-xs text-muted-foreground font-mono">{date}</span>;
      },
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: 'Actions',
            align: 'right' as const,
            width: '90px',
            minWidth: '90px',
            cell: (r: WorkRoleItem) => {
              const roleIdStr = (r.roleId || (r as unknown as { _id?: string })._id) as string;
              return (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(r)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                    title="Edit Work Role"
                  >
                    <Edit2 size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(roleIdStr)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    title="Delete Work Role"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              );
            },
          },
        ]
      : []),
  ];
};
