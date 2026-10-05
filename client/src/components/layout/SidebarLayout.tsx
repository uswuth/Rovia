import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, CheckCheck, Video, Sparkles } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useAuth } from '@/context/AuthContext';
import { type Project } from '@/types/project.types';
import { InviteCodeModal } from '@/components/dashboard/InviteCodeModal';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
import { AppSidebar } from '@/components/app-sidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children }) => {
  const { addProject } = useProject();
  const { org } = useOrganization();
  const { refreshProfile } = useAuth();
  const location = useLocation();

  // Modals state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Notifications state & click-outside ref
  const notificationRef = useRef<HTMLDivElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [notificationsList, setNotificationsList] = useState([
    {
      id: '1',
      title: 'Meeting Scheduled',
      message: 'Sprint Planning meeting scheduled for 3:00 PM.',
      time: '10m ago',
      type: 'meeting',
      unread: true,
    },
    {
      id: '2',
      title: 'Workspace Update',
      message: 'You were added to the Acme Corp workspace.',
      time: '1h ago',
      type: 'system',
      unread: true,
    },
    {
      id: '3',
      title: 'AI Summary Ready',
      message: 'AI Meeting recap is available for review.',
      time: '3h ago',
      type: 'ai',
      unread: true,
    },
  ]);

  // Click outside to close notifications popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };

    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationsOpen]);

  const handleMarkAllRead = () => {
    setNotificationsList((prev) => prev.map((n) => ({ ...n, unread: false })));
    setUnreadCount(0);
  };

  // Regenerating the invite code changes the organization, which now comes from
  // the auth user rather than a separate fetch, so the profile must be re-read
  // for the new code to appear.
  const handleGenerateNewCode = async () => {
    await refreshProfile();
  };

  // `useMutation` invalidates the projects query and `addProject` seeds the
  // cache, so calling `refreshProjects()` here would just be a second request.
  const handleProjectCreated = (newProj: Project) => {
    addProject(newProj);
    setCreateModalOpen(false);
  };

  // Generate Breadcrumbs based on current route
  const getBreadcrumbs = () => {
    const path = location.pathname;
    const items = [{ name: 'IntellMeet', path: '/dashboard' }];

    if (path === '/dashboard') {
      items.push({ name: 'Dashboard', path: '/dashboard' });
    } else if (path.startsWith('/projects')) {
      items.push({ name: 'Projects', path: '/projects' });
      const search = location.search.toLowerCase();
      if (search.includes('status=active')) {
        items.push({ name: 'Active', path: '/projects?status=active' });
      } else if (search.includes('status=completed')) {
        items.push({ name: 'Completed', path: '/projects?status=completed' });
      } else if (search.includes('status=archived')) {
        items.push({ name: 'Archived', path: '/projects?status=archived' });
      }
    } else if (path.startsWith('/meetings')) {
      items.push({ name: 'Meetings', path: '/meetings' });
      if (path === '/meetings/new') {
        items.push({ name: 'Schedule Meeting', path: '/meetings/new' });
      }
    } else if (path.startsWith('/tasks')) {
      items.push({ name: 'Tasks', path: '/tasks' });
    } else if (path.startsWith('/settings')) {
      items.push({ name: 'Settings', path: '/settings' });
    }

    return items;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar
        onOpenInviteModal={() => setInviteModalOpen(true)}
      />

      <SidebarInset>
        {/* Top App Header with Trigger, Vertical Separator, Breadcrumbs & Notifications Bell */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-card/85 dark:bg-card/75 backdrop-blur-xl px-4 transition-[width,height] ease-linear">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1 size-8 rounded-md text-foreground/70 hover:text-emerald-600 dark:hover:text-emerald-400 bg-transparent hover:bg-transparent border-none shadow-none transition-colors" />
            <Separator orientation="vertical" className="h-4 bg-border" />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb.path + idx}>
                      {idx > 0 && <BreadcrumbSeparator />}
                      <BreadcrumbItem className={idx === 0 ? 'hidden sm:inline-flex' : ''}>
                        {isLast ? (
                          <BreadcrumbPage className="font-semibold text-foreground">{crumb.name}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink href={crumb.path} className="text-muted-foreground hover:text-foreground">{crumb.name}</BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </React.Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Right Header Controls: Notification Bell with Badge */}
          <div className="relative flex items-center gap-2" ref={notificationRef}>
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen((prev) => !prev)}
                aria-label="Notifications"
                className="relative flex items-center justify-center p-1.5 bg-transparent text-foreground/70 hover:text-foreground transition-colors cursor-pointer border-none shadow-none"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white shadow-none">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl p-0 space-y-0 overflow-hidden animate-in fade-in-0 zoom-in-95">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
                    <div className="flex items-center gap-2">
                      <Bell size={15} className="text-emerald-500" />
                      <span className="text-xs font-bold text-foreground">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <CheckCheck size={13} />
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
                    {notificationsList.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3.5 flex gap-3 transition-colors hover:bg-muted/50 ${
                          item.unread ? 'bg-emerald-500/[0.03]' : ''
                        }`}
                      >
                        <div className="flex shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-400 pt-0.5">
                          {item.type === 'meeting' ? <Video size={16} /> : item.type === 'ai' ? <Sparkles size={16} /> : <Bell size={16} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
                            <span className="text-[10px] text-muted-foreground shrink-0">{item.time}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{item.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-2 border-t border-border bg-muted/30 text-center">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Notification API integration ready
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main View Area */}
        <main className="relative flex-1 w-full bg-background text-foreground overflow-hidden">
          <div className="relative z-10">{children}</div>
        </main>
      </SidebarInset>

      {/* Invite Code Modal */}
      <InviteCodeModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        inviteCode={org.inviteCode}
        onGenerateNewCode={handleGenerateNewCode}
      />

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleProjectCreated}
      />
    </SidebarProvider>
  );
};
