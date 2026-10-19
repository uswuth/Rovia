import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Home, Compass } from 'lucide-react';
import { IntellMeetLogo } from '@/components/ui/IntellMeetLogo';

// Dot pattern matrix for the giant typographic "404"
// 4: 7 rows x 5 cols
const DIGIT_4 = [
  [0, 3],
  [1, 2], [1, 3],
  [2, 1], [2, 3],
  [3, 0], [3, 1], [3, 2], [3, 3], [3, 4],
  [4, 3],
  [5, 3],
  [6, 3],
];

// 0: 7 rows x 5 cols
const DIGIT_0 = [
  [0, 1], [0, 2], [0, 3],
  [1, 0], [1, 4],
  [2, 0], [2, 4],
  [3, 0], [3, 4],
  [4, 0], [4, 4],
  [5, 0], [5, 4],
  [6, 1], [6, 2], [6, 3],
];

interface DotDigitProps {
  digit: '4' | '0';
  accentColor?: string;
}

const DotDigit: React.FC<DotDigitProps> = ({ digit }) => {
  const points = digit === '4' ? DIGIT_4 : DIGIT_0;
  const rows = 7;
  const cols = 5;

  const isDot = (r: number, c: number) => {
    return points.some(([pr, pc]) => pr === r && pc === c);
  };

  return (
    <div
      className="grid gap-2.5 sm:gap-3.5 md:gap-4.5"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
      aria-hidden="true"
    >
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          const filled = isDot(r, c);
          return (
            <div
              key={`${r}-${c}`}
              className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4.5 md:h-4.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor: filled
                  ? 'var(--custom-accent, var(--primary))'
                  : 'transparent',
                opacity: filled ? 1 : 0,
                transform: filled ? 'scale(1)' : 'scale(0.3)',
                boxShadow: filled
                  ? '0 0 12px color-mix(in srgb, var(--custom-accent, var(--primary)) 40%, transparent)'
                  : 'none',
              }}
            />
          );
        })
      )}
    </div>
  );
};

export const NotFoundPage: React.FC = () => {
  return (
    <main className="min-h-dvh w-full bg-background text-foreground flex flex-col justify-between p-6 sm:p-10 lg:p-14 selection:bg-primary/20 selection:text-primary relative overflow-hidden transition-colors duration-200">
      {/* Background ambient lighting matching project theme tokens */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full blur-[120px] opacity-20 dark:opacity-15"
        style={{ background: 'var(--custom-accent, var(--primary))' }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full blur-[140px] opacity-15 dark:opacity-10"
        style={{ background: 'var(--custom-accent, var(--primary))' }}
      />

      {/* TOP BAR / NAVIGATION HEADER */}
      <header className="w-full flex items-center justify-between z-10 relative">
        {/* Left: Brand identity & quick utility links */}
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 group cursor-pointer"
            aria-label="IntellMeet Home"
          >
            <IntellMeetLogo size={26} />
            <span className="font-bold text-sm tracking-tight text-foreground font-sans">
              Intell<span className="text-primary">Meet</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/40 dark:bg-muted/20 border border-border/60 rounded-full px-3 py-1">
            <Link
              to="/dashboard"
              className="px-2.5 py-1 rounded-full hover:text-foreground transition-colors"
            >
              Overview
            </Link>
            <Link
              to="/projects"
              className="px-2.5 py-1 rounded-full hover:text-foreground transition-colors"
            >
              Projects
            </Link>
            <Link
              to="/teams"
              className="px-2.5 py-1 rounded-full hover:text-foreground transition-colors"
            >
              Teams
            </Link>
            <Link
              to="/tasks"
              className="px-2.5 py-1 rounded-full hover:text-foreground transition-colors"
            >
              Tasks
            </Link>
          </nav>
        </div>

        {/* Top Right: Home Page URL action */}
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 h-9 px-4 text-xs font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all duration-200 shadow-xs cursor-pointer active:scale-95"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Return Home</span>
          </Link>
        </div>
      </header>

      {/* CENTER: ICONIC DOTTED 404 GRAPHIC */}
      <section className="my-auto py-12 sm:py-16 flex flex-col items-center justify-center z-10">
        <div className="flex items-center justify-center gap-8 sm:gap-14 md:gap-20 select-none">
          <DotDigit digit="4" />
          <DotDigit digit="0" />
          <DotDigit digit="4" />
        </div>
      </section>

      {/* BOTTOM: EDITORIAL STATEMENT & ACTION LINKS */}
      <footer className="w-full flex flex-col sm:flex-row sm:items-end justify-between gap-6 z-10 pt-6 border-t border-border/40">
        <div className="max-w-md space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-sans leading-tight">
            We couldn’t find the page you were looking for.
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed">
            The resource you requested may have moved, been archived, or never existed in this workspace.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 h-9.5 px-4 rounded-sm border border-border text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Previous Page</span>
          </button>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 h-9.5 px-5 rounded-sm bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all duration-200 shadow-xs cursor-pointer"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Open Dashboard</span>
          </Link>
        </div>
      </footer>
    </main>
  );
};

export default NotFoundPage;