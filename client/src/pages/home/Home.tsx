import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  FolderGit2,
  Users,
  CheckSquare,
  ArrowRight,
  Shield,
  Moon,
  Sun,

  CheckCircle2,

} from 'lucide-react';

const GithubIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { IntellMeetLogo } from '@/components/ui/IntellMeetLogo';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/theme-context';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary relative">
      {/* Top Floating / Docked Navbar with Animation */}
      <div
        className={`sticky z-50 w-full transition-all duration-300 ease-out ${isScrolled
          ? 'top-0 px-0'
          : 'top-2 px-4'
          }`}
      >
        <header
          className={`w-full transition-all duration-300 ease-out flex items-center justify-between gap-4 h-13 px-4 sm:px-6 bg-card/90 backdrop-blur-md ${isScrolled
            ? 'rounded-none border-b border-transparent shadow-md'
            : 'rounded-xs border border-border/80 shadow-none'
            }`}
        >
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <IntellMeetLogo size={22} />
            <span className="font-bold text-sm tracking-tight text-foreground font-mono">
              IntellMeet
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <a
              href="https://github.com/uswuth/rovia.git"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center justify-center gap-1.5 px-2.5 text-xs font-medium rounded-xs border border-border/80 bg-background/60 hover:bg-muted text-foreground transition-colors cursor-pointer select-none"
              title="View on GitHub"
            >
              <GithubIcon size={13} />
              <span className="hidden sm:inline">Source</span>
            </a>

            <Button
              variant="outline"
              size="icon-sm"
              onClick={toggleTheme}
              className="rounded-xs text-muted-foreground hover:text-foreground cursor-pointer border-border/80 bg-background/60"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </Button>

            {isAuthenticated ? (
              <Button
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="rounded-xs gap-1.5 cursor-pointer text-xs font-semibold"
              >
                <span>Dashboard</span>
                <ArrowRight size={13} />
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/login')}
                  className="rounded-xs text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Sign In
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate('/signup')}
                  className="rounded-xs text-xs gap-1 font-semibold cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight size={13} />
                </Button>
              </>
            )}
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="flex-1 w-full flex flex-col items-center">
        {/* Hero Section */}
        <section className="w-full max-w-5xl px-4 sm:px-6 pt-14 sm:pt-20 pb-10 text-center space-y-6">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1] max-w-4xl mx-auto">
            Unleash the power of <br className="hidden sm:inline" />
            <span className="text-foreground">unified collaboration</span>
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Say goodbye to scattered conference links, unmanaged rooms, and decoupled spreadsheets.
            IntellMeet links WebRTC meetings directly to your organization rosters, projects, and sprint deliverables.
          </p>

          <div className="pt-2">
            {!isAuthenticated && (
              <Button
                size="lg"
                onClick={() => navigate('/signup')}
                className="h-9 px-6 text-xs font-semibold gap-2 cursor-pointer shadow-xs"
              >
                <span>Get Started Free</span>
                <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </section>

        {/* Hero App Mock Preview Window */}
        <section className="w-full max-w-5xl px-4 sm:px-6 pb-20">
          <div className="rounded-sm border border-border/80 bg-card/95 shadow-2xl overflow-hidden backdrop-blur-xl">
            {/* Window Title Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/70 bg-muted/30 text-xs">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
                  <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
                  <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <span className="text-[11px] font-mono text-muted-foreground ml-2">app.intellmeet.local</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                <Badge tone="success" className="text-[9px] py-0">WORKSPACE ACTIVE</Badge>
              </div>
            </div>

            {/* Dashboard Inner Canvas */}
            <div className="p-4 sm:p-6 space-y-5">
              {/* Top Overview Metric Tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xs border border-border/80 bg-background/50 space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span className="font-semibold uppercase tracking-wider">Projects</span>
                    <Badge tone="info" className="text-[9px] px-1 py-0 font-mono">PRJ</Badge>
                  </div>
                  <p className="text-2xl font-bold text-foreground">12</p>
                  <p className="text-[10px] text-muted-foreground">Active initiatives</p>
                </div>

                <div className="p-3.5 rounded-xs border border-border/80 bg-background/50 space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span className="font-semibold uppercase tracking-wider">Sub-Teams</span>
                    <Badge tone="neutral" className="text-[9px] px-1 py-0 font-mono">TEM</Badge>
                  </div>
                  <p className="text-2xl font-bold text-foreground">24</p>
                  <p className="text-[10px] text-muted-foreground">Frontend, Backend, Design</p>
                </div>

                <div className="p-3.5 rounded-xs border border-border/80 bg-background/50 space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span className="font-semibold uppercase tracking-wider">Live Meets</span>
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">4</p>
                  <p className="text-[10px] text-primary">WebRTC Mesh Active</p>
                </div>

                <div className="p-3.5 rounded-xs border border-border/80 bg-background/50 space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span className="font-semibold uppercase tracking-wider">Tasks</span>
                    <Badge tone="success" className="text-[9px] px-1 py-0 font-mono">88% Done</Badge>
                  </div>
                  <p className="text-2xl font-bold text-foreground">46</p>
                  <p className="text-[10px] text-muted-foreground">Sprint deliverables</p>
                </div>
              </div>

              {/* Mock Active Meeting & Roster Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="md:col-span-2 p-4 rounded-xs border border-border/80 bg-background/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-bold text-xs text-foreground">Sprint 24 — Architecture & Sync</span>
                      <CodeBadge code="MTG-001" />
                    </div>
                    <Badge tone="success" className="text-[10px]">IN_PROGRESS</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-20 rounded-xs bg-card border border-border/80 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                      <div className="size-7 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-[10px]">A</div>
                      <span className="text-[11px] font-semibold text-foreground truncate w-full">ArloXD</span>
                      <span className="text-[9px] text-primary font-mono -mt-1">Host</span>
                    </div>
                    <div className="h-20 rounded-xs bg-card border border-border/80 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                      <div className="size-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">M</div>
                      <span className="text-[11px] font-semibold text-foreground truncate w-full">Member2</span>
                      <span className="text-[9px] text-muted-foreground font-mono -mt-1">Member</span>
                    </div>
                    <div className="h-20 rounded-xs bg-card border border-border/80 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                      <div className="size-7 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center text-[10px]">M</div>
                      <span className="text-[11px] font-semibold text-foreground truncate w-full">member1</span>
                      <span className="text-[9px] text-muted-foreground font-mono -mt-1">Member</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xs border border-border/80 bg-background/60 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground pb-1.5 border-b border-border/50">
                      <span>Deliverables</span>
                      <Badge tone="neutral" className="text-[10px]">Sprint 24</Badge>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <CheckCircle2 size={13} className="text-primary shrink-0" />
                          <span className="truncate text-foreground text-[11px]">Turn fallback server</span>
                        </div>
                        <Badge tone="success" className="text-[9px] py-0">Completed</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="size-1.5 rounded-full bg-amber-500 shrink-0 ml-1.5 mr-0.5" />
                          <span className="truncate text-foreground text-[11px]">Roster modal columns</span>
                        </div>
                        <Badge tone="warning" className="text-[9px] py-0">Review</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span>2 of 2 tasks tracked</span>
                    <span className="text-primary">100% on schedule</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Narrative Headline Section */}
        <section className="w-full max-w-5xl px-4 sm:px-6 py-12 border-t border-border/60">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-snug">
              Who said workspace operations have to be fragmented?
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Every meeting in IntellMeet belongs to a project or team with clear host governance.
              No guest hijackers, no unassigned action items, and zero confusion over who holds the mic.
              Designed with strict Mongoose validation, Typegoose role guards, and instantaneous client updates.
            </p>
          </div>
        </section>

        {/* Bento Grid: "Everything you need. Nothing you don't." */}
        <section className="w-full max-w-5xl px-4 sm:px-6 py-12 border-t border-border/60 space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Everything you need. <br />
              Nothing you don't.
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              Engineered exclusively around the core pillars of modern engineering operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bento Card 1: Video Mesh */}
            <div className="group rounded-sm border border-border/80 bg-card p-5 space-y-3 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2 w-fit rounded-xs bg-primary/10 text-primary border border-primary/20">
                  <Video size={16} />
                </div>
                <h3 className="font-bold text-sm text-foreground">WebRTC Video Mesh</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Join by room code or direct share link. Built-in camera, microphone, screen share, and member lobby controls.
                </p>
              </div>

              <div className="p-3 rounded-xs border border-border/60 bg-background/50 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Code</span>
                  <CodeBadge code="789-234" />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Encryption</span>
                  <span className="text-primary font-semibold">DTLS-SRTP</span>
                </div>
              </div>
            </div>

            {/* Bento Card 2: Projects & Teams Hierarchy */}
            <div className="group rounded-sm border border-border/80 bg-card p-5 space-y-3 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2 w-fit rounded-xs bg-primary/10 text-primary border border-primary/20">
                  <FolderGit2 size={16} />
                </div>
                <h3 className="font-bold text-sm text-foreground">Projects & Sub-Teams</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Structure engineering deliverables under project codes like PRJ-001 with assigned hosts and member rosters.
                </p>
              </div>

              <div className="p-3 rounded-xs border border-border/60 bg-background/50 space-y-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <FolderGit2 size={12} className="text-primary" />
                  <span className="font-bold text-foreground text-[11px]">Golang CLI-Todo</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                  <CodeBadge code="TEM001" />
                  <span>Frontend Team</span>
                </div>
              </div>
            </div>

            {/* Bento Card 3: Multi-Tenant RBAC Governance */}
            <div className="group rounded-sm border border-border/80 bg-card p-5 space-y-3 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2 w-fit rounded-xs bg-primary/10 text-primary border border-primary/20">
                  <Shield size={16} />
                </div>
                <h3 className="font-bold text-sm text-foreground">Role Guards & Scopes</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Hierarchical SuperAdmin, Admin, Host, and Member privileges. Server-enforced locks prevent privilege escalation.
                </p>
              </div>

              <div className="p-3 rounded-xs border border-border/60 bg-background/50 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground font-medium">SuperAdmin</span>
                  <span className="text-[10px] text-emerald-500 font-mono">Owner</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground font-medium">Host</span>
                  <span className="text-[10px] text-primary font-mono">Assigned</span>
                </div>
              </div>
            </div>

            {/* Bento Card 4: Actionable Deliverables (Spans 2 cols) */}
            <div className="md:col-span-2 group rounded-sm border border-border/80 bg-card p-5 space-y-3 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2 w-fit rounded-xs bg-primary/10 text-primary border border-primary/20">
                  <CheckSquare size={16} />
                </div>
                <h3 className="font-bold text-sm text-foreground">Tasks & Deliverables Management</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Assign actionable responsibilities directly from meetings. Filter by status, assignees, and deadlines with instant sync.
                </p>
              </div>

              <div className="p-3 rounded-xs border border-border/60 bg-background/50 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-[11px] py-1 border-b border-border/50">
                  <span className="text-foreground">DTLS Turn fallback verification</span>
                  <Badge tone="success" className="text-[9px]">COMPLETED</Badge>
                </div>
                <div className="flex items-center justify-between text-[11px] py-1">
                  <span className="text-foreground">TanStack virtualized roster table</span>
                  <Badge tone="info" className="text-[9px]">IN_PROGRESS</Badge>
                </div>
              </div>
            </div>

            {/* Bento Card 5: Member Roster Modal Inspection */}
            <div className="group rounded-sm border border-border/80 bg-card p-5 space-y-3 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2 w-fit rounded-xs bg-primary/10 text-primary border border-primary/20">
                  <Users size={16} />
                </div>
                <h3 className="font-bold text-sm text-foreground">Unified Roster Inspection</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Clean avatar grouping with modal inspection. Real user names, organization roles, and status tokens.
                </p>
              </div>

              <div className="flex items-center gap-1.5 p-2 rounded-xs border border-border/60 bg-background/50">
                <div className="size-6 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-[10px]">A</div>
                <div className="size-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">M</div>
                <div className="size-6 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center text-[10px]">M</div>
                <span className="text-[10px] text-muted-foreground font-mono pl-2">+3 members</span>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section className="w-full max-w-5xl px-4 sm:px-6 py-16 text-center space-y-5 border-t border-border/60">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            See where real-time workspace collaboration <br />
            can take your team.
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            Ready in under two minutes. No enterprise sales hurdles, no license locking.
          </p>

          <div className="pt-2">
            <Button
              size="lg"
              onClick={() => navigate('/signup')}
              className="h-9 px-6 text-xs font-semibold gap-2 cursor-pointer shadow-xs"
            >
              <span>Get Started</span>
              <ArrowRight size={14} />
            </Button>
          </div>
        </section>

        {/* Minimal Clean Footer */}
        <footer className="w-full border-t border-border/60 py-8 bg-background">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <IntellMeetLogo size={16} />
              <span className="font-mono text-foreground font-semibold">IntellMeet</span>
              <span>—</span>
              <span>Unified MERN & WebRTC Workspace</span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <span className="hover:text-foreground cursor-pointer transition-colors" onClick={() => navigate('/login')}>Sign In</span>
              <span className="hover:text-foreground cursor-pointer transition-colors" onClick={() => navigate('/signup')}>Sign Up</span>
              <span className="hover:text-foreground cursor-pointer transition-colors" onClick={() => navigate('/meetings')}>Meetings</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Home;
