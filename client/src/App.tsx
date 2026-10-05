import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
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
  const { id = '' } = useParams();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-xs text-muted-foreground">Loading…</span>
      </div>
    );
  }
  const hasGuestSession = Boolean(
    sessionStorage.getItem(`meeting_guest_${id}`) || sessionStorage.getItem('intellmeet_guest_name')
  );
  if (!isAuthenticated && !hasGuestSession) return <Navigate to="/login" replace />;
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

                      {/* Protected Dashboard Routes with SidebarLayout */}
                      <Route element={<ProtectedRoute />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/projects" element={<Projects />} />
                        <Route path="/projects/new" element={<CreateProject />} />
                        <Route path="/projects/:id/edit" element={<CreateProject />} />
                        <Route path="/meetings" element={<Meetings />} />
                        <Route path="/meetings/new" element={<CreateMeeting />} />
                        <Route path="/tasks" element={<Tasks />} />
                        <Route path="/settings" element={<SettingsPage />} />
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
