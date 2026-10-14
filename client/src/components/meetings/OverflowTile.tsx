import React from 'react';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OverflowTileProps {
  count: number;
  onClick?: () => void;
  compact?: boolean;
}

/** Overflow participant tile displaying `+N more` when participant list exceeds visible grid slots */
export const OverflowTile: React.FC<OverflowTileProps> = ({ count, onClick, compact = false }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-xs text-white shadow-lg transition-all duration-300",
        "bg-slate-950/90 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
      )}
      title={`Click to view all ${count} additional participants`}
      aria-label={`View ${count} more participants`}
    >
      <div
        className={cn(
          "rounded-full bg-slate-900 border-2 border-emerald-500/40 flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:border-emerald-400 group-hover:shadow-md group-hover:shadow-emerald-500/20",
          compact ? "size-12" : "size-16 sm:size-20"
        )}
      >
        <div className="flex flex-col items-center justify-center">
          <Users size={compact ? 12 : 16} className="text-emerald-400/80 mb-0.5" />
          <span
            className={cn(
              "font-bold text-emerald-400 select-none leading-none",
              compact ? "text-xs" : "text-sm sm:text-base"
            )}
          >
            +{count}
          </span>
        </div>
      </div>

      <span
        className={cn(
          "font-semibold text-slate-300 select-none group-hover:text-white transition-colors",
          compact ? "text-[10px] mt-1" : "text-xs sm:text-sm mt-2"
        )}
      >
        more
      </span>
      <span className="text-[10px] text-muted-foreground group-hover:text-emerald-400 transition-colors mt-0.5">
        Click to view all
      </span>
    </button>
  );
};

export default OverflowTile;
