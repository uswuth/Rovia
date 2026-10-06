import React, { useState } from 'react';
import { CheckSquare, Clock, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { getProjectName } from '@/types/project.types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Modal, ModalFooterCancel } from '@/components/ui/modal';
import { FormField } from '@/components/ui/form-field';
import { getTaskPriorityTone } from '@/lib/status-tone';

type TaskStatus = 'To Do' | 'In Progress' | 'Done';
type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

const PRIORITY_OPTIONS = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
  { value: 'Urgent', label: 'Urgent' },
];

const STATUS_OPTIONS = [
  { value: 'To Do', label: 'To Do' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Done', label: 'Done' },
];

interface TaskItem {
  id: string;
  title: string;
  projectName: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  createdAt: string;
}

const statusIcon: Record<TaskStatus, React.ReactNode> = {
  Done: <CheckCircle2 size={14} className="text-emerald-500 dark:text-emerald-400" />,
  'In Progress': <Clock size={14} className="text-amber-500 dark:text-amber-400" />,
  'To Do': <AlertCircle size={14} className="text-muted-foreground" />,
};

export const Tasks: React.FC = () => {
  const { selectedProject } = useProject();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('Medium');
  const [newStatus, setNewStatus] = useState<TaskStatus>('To Do');
  const [newAssignee, setNewAssignee] = useState('arlo');

  const activeProjectName = getProjectName(selectedProject);

  const displayedTasks = tasks;

  const handleCloseModal = () => {
    setNewTitle('');
    setTitleError('');
    setNewPriority('Medium');
    setNewStatus('To Do');
    setNewAssignee('arlo');
    setCreateModalOpen(false);
  };

  const TITLE_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9 _-]*[a-zA-Z0-9])?$/;

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      setTitleError('Task title is required');
      return;
    }
    if (!TITLE_REGEX.test(trimmedTitle)) {
      setTitleError('Task title can only contain letters, numbers, spaces, -, _, and cannot start or end with a symbol');
      return;
    }
    setTitleError('');

    const newTask: TaskItem = {
      id: `TASK-${Date.now().toString().slice(-4)}`,
      title: trimmedTitle,
      projectName: activeProjectName,
      status: newStatus,
      priority: newPriority,
      assignee: newAssignee,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setTasks((prev) => [newTask, ...prev]);
    handleCloseModal();
  };

  const activeProjectStatus = (selectedProject?.projectStatus || selectedProject?.status || '').toLowerCase();
  const isSelectedProjectReadOnly = activeProjectStatus === 'completed' || activeProjectStatus === 'archived';

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <CheckSquare className="text-emerald-500 dark:text-emerald-400" size={24} />
            <span>Tasks</span>
          </h1>
          {activeProjectName && (
            <p className="text-xs text-muted-foreground mt-1">
              Showing sprint tasks for project '{activeProjectName}'.
            </p>
          )}
        </div>

        <Button
          size="sm"
          disabled={isSelectedProjectReadOnly}
          onClick={() => !isSelectedProjectReadOnly && setCreateModalOpen(true)}
          className="gap-1.5 self-start sm:self-auto cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title={isSelectedProjectReadOnly ? `Project '${activeProjectName}' is ${activeProjectStatus}. Set status to Active to create tasks.` : 'Create New Task'}
        >
          <span>+ Create Task</span>
        </Button>
      </div>

      {isSelectedProjectReadOnly && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-500" />
          <div>
            <p className="font-bold">Project is Read-Only ({activeProjectStatus.toUpperCase()})</p>
            <p className="mt-0.5">
              Selected project <strong>{activeProjectName}</strong> is currently marked as <strong>{activeProjectStatus}</strong>. New tasks cannot be created. Change project status to <strong>Active</strong> to enable task creation.
            </p>
          </div>
        </div>
      )}

      {/* Content Area */}
      {tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks created yet"
          description={
            selectedProject
              ? `There are no active sprint tasks for '${activeProjectName}'.`
              : 'There are no active tasks created in your workspace yet.'
          }
          actionLabel={isSelectedProjectReadOnly ? undefined : "Create First Task"}
          onAction={isSelectedProjectReadOnly ? undefined : () => setCreateModalOpen(true)}
          accentColor="emerald"
        />
      ) : (
        <div className="rounded-md border border-border bg-card text-card-foreground overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Sprint Backlog & Deliverables</span>
            <span className="text-emerald-500 dark:text-emerald-400 font-mono text-[11px]">{displayedTasks.length} Tickets</span>
          </div>

          <div className="divide-y divide-border">
            {displayedTasks.map((t) => (
              <div
                key={t.id}
                className="p-4 hover:bg-secondary/50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{t.id}</span>
                    <Badge tone="accent">{t.projectName}</Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <Badge tone={getTaskPriorityTone(t.priority)}>{t.priority}</Badge>

                  <span className="flex items-center gap-1.5 text-xs text-foreground bg-secondary/80 border border-border px-2.5 py-1 rounded-sm">
                    {statusIcon[t.status]}
                    <span>{t.status}</span>
                  </span>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/80 px-2 py-1 rounded-sm border border-border">
                    <User size={12} className="text-emerald-600 dark:text-emerald-400" />
                    <span>{t.assignee}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={createModalOpen}
        onClose={handleCloseModal}
        title="Create New Task"
        description="Add a ticket or deliverable for your team."
        footer={
          <>
            <ModalFooterCancel onClick={handleCloseModal} />
            <Button type="submit" form="create-task-form">
              Create Task
            </Button>
          </>
        }
      >
        <form id="create-task-form" onSubmit={handleCreateTask} className="space-y-4">
          <FormField label="Task Title" htmlFor="task-title" required error={titleError}>
            <Input
              id="task-title"
              value={newTitle}
              onChange={(e) => {
                setNewTitle(e.target.value);
                if (titleError) setTitleError('');
              }}
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Priority" htmlFor="task-priority">
              <Select
                value={newPriority}
                onValueChange={(val) => {
                  if (typeof val === 'string') setNewPriority(val as TaskPriority);
                }}
              >
                <SelectTrigger id="task-priority" className="w-full">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Status" htmlFor="task-status">
              <Select
                value={newStatus}
                onValueChange={(val) => {
                  if (typeof val === 'string') setNewStatus(val as TaskStatus);
                }}
              >
                <SelectTrigger id="task-status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField label="Assignee" htmlFor="task-assignee">
            <Input
              id="task-assignee"
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
};
