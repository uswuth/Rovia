import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createQueryClient } from '@/api/queryClient';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProjectProvider } from '@/context/ProjectContext';
import { OrganizationProvider } from '@/context/OrganizationContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { TimeFormatProvider } from '@/context/TimeFormatContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarLayout } from '@/components/layout/SidebarLayout';

const Login = lazy(() => import('@/pages/login/Login').then((m) => ({ default: m.Login })));
const Signup = lazy(() => import('@/pages/signup/Signup').then((m) => ({ default: m.Signup })));
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard').then((m) => ({ default: m.Dashboard })));
const Projects = lazy(() => import('@/pages/projects/Projects').then((m) => ({ default: m.Projects })));
const CreateProject = lazy(() => import('@/pages/projects/CreateProject').then((m) => ({ default: m.CreateProject })));
const Meetings = lazy(() => import('@/pages/meetings/Meetings').then((m) => ({ default: m.Meetings })));
const MeetingRoom = lazy(() => import('@/pages/meetings/MeetingRoom').then((m) => ({ default: m.MeetingRoom })));
const MeetingLobby = lazy(() => import('@/pages/meetings/MeetingLobby').then((m) => ({ default: m.MeetingLobby })));
const CreateMeeting = lazy(() => import('@/pages/meetings/CreateMeeting').then((m) => ({ default: m.CreateMeeting })));
const Tasks = lazy(() => import('@/pages/tasks/Tasks').then((m) => ({ default: m.Tasks })));
const SettingsPage = lazy(() => import('@/pages/settings/Settings').then((m) => ({ default: m.SettingsPage })));
const AdminOrgManager = lazy(() => import('@/pages/admin/AdminOrgManager'));
const ServerAdminLogin = lazy(() => import('@/pages/admin/ServerAdminLogin').then((m) => ({ default: m.ServerAdminLogin })));
const ServerAdminDashboard = lazy(() => import('@/pages/admin/ServerAdminDashboard').then((m) => ({ default: m.ServerAdminDashboard })));
const OrgMembers = lazy(() => import('@/pages/organization/OrgMembers').then((m) => ({ default: m.OrgMembers })));
const CreateOrgMember = lazy(() => import('@/pages/organization/CreateOrgMember').then((m) => ({ default: m.CreateOrgMember })));
const UserProfile = lazy(() => import('@/pages/organization/UserProfile').then((m) => ({ default: m.UserProfile })));
const OrgWorkRoles = lazy(() => import('@/pages/organization/OrgWorkRoles').then((m) => ({ default: m.OrgWorkRoles })));
const Teams = lazy(() => import('@/pages/teams/Teams').then((m) => ({ default: m.Teams })));
const CreateTeam = lazy(() => import('@/pages/teams/CreateTeam').then((m) => ({ default: m.CreateTeam })));
const CreateTask = lazy(() => import('@/pages/tasks/CreateTask').then((m) => ({ default: m.CreateTask })));

const SuspenseFallback = () => (

  <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
    <div className="flex items-center gap-2 text-xs font-medium">
      <div className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      <span>Loading...</span>
    </div>
  </div>
);

const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <div className="flex items-center gap-2 text-xs font-medium">
          <div className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <span>Loading IntellMeet…</span>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <SidebarLayout>
      <Outlet />
    </SidebarLayout>
  );
};

const GuestRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  if (!loading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

/**
 * Authenticates without SidebarLayout, for routes that own the whole viewport
 * (the meeting room). Reusing ProtectedRoute would force the sidebar frame onto
 * a full-screen surface.
 */
const MeetingRoomRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-xs text-muted-foreground">Loading…</span>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
};

const queryClient = createQueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ThemeProvider>
        <TimeFormatProvider>
          <AuthProvider>
            <ProjectProvider>
              <OrganizationProvider>
                <TooltipProvider>
                  <Suspense fallback={<SuspenseFallback />}>
                    <Routes>
                      <Route path="/" element={<Navigate to="/login" replace />} />
                      <Route
                        path="/login"
                        element={
                          <GuestRoute>
                            <Login />
                          </GuestRoute>
                        }
                      />
                      <Route
                        path="/signup"
                        element={
                          <GuestRoute>
                            <Signup />
                          </GuestRoute>
                        }
                      />

                      {/* Full-screen routes: authenticated, but no sidebar frame. */}
                      {/* Public meeting pre-join lobby for link recipients & visitors */}
                      <Route path="/meetings/join/:code" element={<MeetingLobby />} />

                      <Route element={<MeetingRoomRoute />}>
                        <Route path="/meetings/:id/room" element={<MeetingRoom />} />
                      </Route>

                      {/* Server Admin Control Plane Routes (Unframed) */}
                      <Route path="/server-admin" element={<Navigate to="/server-admin/dashboard" replace />} />
                      <Route path="/server-admin/login" element={<ServerAdminLogin />} />
                      <Route path="/server-admin/dashboard" element={<ServerAdminDashboard />} />
                      <Route path="/server-admin/organizations" element={<AdminOrgManager />} />
                      <Route path="/server-admin/console" element={<AdminOrgManager />} />

                      {/* Protected Dashboard Routes with SidebarLayout */}
                      <Route element={<ProtectedRoute />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/organization/members" element={<OrgMembers />} />
                        <Route path="/organization/members/new" element={<CreateOrgMember />} />
                        <Route path="/organization/members/code/:userCode" element={<UserProfile />} />
                        <Route path="/organization/members/:id/profile" element={<UserProfile />} />
                        <Route path="/organization/members/:id/edit" element={<CreateOrgMember />} />
                        <Route path="/organization/work-roles" element={<OrgWorkRoles />} />
                        <Route path="/organization/job-titles" element={<Navigate to="/organization/work-roles" replace />} />
                        <Route path="/organization/job-roles" element={<Navigate to="/organization/work-roles" replace />} />
                        <Route path="/projects" element={<Projects />} />
                        <Route path="/projects/new" element={<CreateProject />} />
                        <Route path="/projects/:id/edit" element={<CreateProject />} />
                        <Route path="/teams" element={<Teams />} />
                        <Route path="/teams/new" element={<CreateTeam />} />
                        <Route path="/teams/:id/edit" element={<CreateTeam />} />
                        <Route path="/meetings" element={<Meetings />} />
                        <Route path="/meetings/new" element={<CreateMeeting />} />
                        <Route path="/tasks" element={<Tasks />} />
                        <Route path="/tasks/new" element={<CreateTask />} />
                        <Route path="/tasks/:id/edit" element={<CreateTask />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/admin/organizations" element={<AdminOrgManager />} />
                      </Route>
                    </Routes>
                  </Suspense>
                </TooltipProvider>
              </OrganizationProvider>
            </ProjectProvider>
          </AuthProvider>
        </TimeFormatProvider>
      </ThemeProvider>
    </BrowserRouter>
    {/* Devtools are stripped from the production bundle by the Vite build. */}
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
);

export default App;
