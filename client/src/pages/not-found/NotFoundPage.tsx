import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { IntellMeetLogo } from '@/components/ui/IntellMeetLogo';

// Ultra-clean, authentic ASCII 404 banner
const ASCII_404_LEGIBLE = [
  '    ▄▄   ▄▄▄▄     ▄▄ ',
  '   ▄▀█  ▄▀  ▀▄   ▄▀█ ',
  '  █▀ █  █  ▄ █  █▀ █ ',
  ' █▄▄▄█▄ █    █ █▄▄▄█▄',
  '     █   █▄▄█      █ ',
];

export const NotFoundPage: React.FC = () => {
  // Interactive mouse illumination & pulse state
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isGlitching, setIsGlitching] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    setMousePos({
      x: Math.round((clientX / innerWidth) * 100),
      y: Math.round((clientY / innerHeight) * 100),
    });
  }, []);

  const triggerAsciiPulse = () => {
    setIsGlitching(true);
    setTimeout(() => setIsGlitching(false), 300);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="dark min-h-dvh w-full bg-[#0a0d12] text-foreground flex flex-col justify-between selection:bg-accent selection:text-accent-foreground relative overflow-hidden transition-colors duration-200"
    >
      {/* Interactive cursor spotlight glow */}
      <div
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 h-[420px] w-[600px] rounded-full blur-[140px] opacity-15 bg-primary transition-all duration-300 ease-out"
        style={{
          left: `${mousePos.x}%`,
          top: `${mousePos.y}%`,
        }}
      />

      {/* TOP NAV BAR - Pure dark theme, responsive for mobile & desktop */}
      <header className="sticky top-0 z-20 flex h-14 w-full shrink-0 items-center justify-between border-b border-border/40 bg-[#0c1015]/80 backdrop-blur-xl px-3 sm:px-8">
        <div className="flex items-center gap-2 sm:gap-6 min-w-0">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 group cursor-pointer shrink-0"
            aria-label="IntellMeet Home"
          >
            <IntellMeetLogo size={24} />
            <span className="font-bold text-sm tracking-tight text-foreground font-sans hidden xs:inline sm:inline">
              Intell<span className="text-primary">Meet</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Link
              to="/dashboard"
              className="px-2 py-1 rounded-sm hover:text-foreground hover:bg-accent transition-colors"
            >
              Overview
            </Link>
            <Link
              to="/projects"
              className="px-2 py-1 rounded-sm hover:text-foreground hover:bg-accent transition-colors"
            >
              Projects
            </Link>
            <Link
              to="/teams"
              className="px-2 py-1 rounded-sm hover:text-foreground hover:bg-accent transition-colors"
            >
              Teams
            </Link>
            <Link
              to="/tasks"
              className="px-2 py-1 rounded-sm hover:text-foreground hover:bg-accent transition-colors"
            >
              Tasks
            </Link>
          </nav>
        </div>

        {/* Top Right: Previous Page & Open Dashboard buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 h-8 sm:h-8.5 px-2.5 sm:px-3.5 rounded-sm border border-border/60 text-xs font-semibold text-foreground/90 hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Previous Page"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Previous Page</span>
            <span className="sm:hidden">Back</span>
          </button>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 h-8 sm:h-8.5 px-3 sm:px-4 rounded-sm bg-primary hover:opacity-90 text-slate-950 text-xs font-bold transition-all duration-200 shadow-xs cursor-pointer active:scale-95"
          >
            <Compass className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Open Dashboard</span>
            <span className="sm:hidden">Dashboard</span>
          </Link>
        </div>
      </header>

      {/* CENTER: CRISP, RESPONSIVE ASCII 404 WITH BALANCED WATERMARK */}
      <section className="my-auto py-8 sm:py-16 px-4 flex flex-col items-center justify-center relative z-10 select-none overflow-hidden">
        {/* Subtle, responsive low-opacity background watermark */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none -z-10"
          aria-hidden="true"
        >
          <span
            className="font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-foreground/[0.03] whitespace-nowrap leading-none select-none"
            style={{ fontSize: 'clamp(1.75rem, 7vw, 8.5rem)' }}
          >
            PAGE NOT FOUND
          </span>
        </div>

        <pre
          onClick={triggerAsciiPulse}
          className={`font-mono leading-[1.0] font-normal select-none whitespace-pre text-left inline-block transition-all duration-200 max-w-full overflow-hidden text-primary cursor-pointer hover:scale-105 active:scale-95 ${isGlitching ? 'opacity-80 translate-x-[2px] skew-x-1' : ''
            }`}
          title="Click to pulse"
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 'clamp(11px, 2.6vw, 44px)',
            textShadow: isGlitching
              ? '0 0 18px var(--primary), 0 0 30px var(--accent)'
              : '0 0 10px var(--accent)',
          }}
        >
          {ASCII_404_LEGIBLE.join('\n')}
        </pre>
      </section>

      {/* BOTTOM: EDITORIAL STATEMENT ONLY */}
      <footer className="w-full px-4 sm:px-10 py-6 sm:pb-8 bg-transparent z-10">
        <div className="max-w-lg space-y-1">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground font-sans">
            We couldn’t find the page you were looking for.
          </h1>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            The route or resource you requested may have moved, been deleted, or never existed in this workspace.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default NotFoundPage;