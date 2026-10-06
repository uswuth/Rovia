import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [5, 10, 25, 50],
  onPageChange,
  onPageSizeChange,
  className = '',
}) => {
  const maxPages = Math.max(1, totalPages);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const [prevPage, setPrevPage] = React.useState(currentPage);
  const [inputPage, setInputPage] = React.useState(String(currentPage));

  if (prevPage !== currentPage) {
    setPrevPage(currentPage);
    setInputPage(String(currentPage));
  }

  const handlePageSubmit = () => {
    const p = parseInt(inputPage, 10);
    if (!isNaN(p)) {
      const validPage = Math.max(1, Math.min(p, maxPages));
      onPageChange(validPage);
      setInputPage(String(validPage));
    } else {
      setInputPage(String(currentPage));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePageSubmit();
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 py-2.5 px-4 text-xs text-muted-foreground border-t border-border bg-card/50 ${className}`}>
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
        <span className="text-xs">
          <strong className="text-foreground">{startItem}-{endItem}</strong> of{' '}
          <strong className="text-foreground">{totalItems}</strong>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span>Page</span>
          <input
            type="number"
            min={1}
            max={maxPages}
            value={inputPage}
            onChange={(e) => setInputPage(e.target.value)}
            onBlur={handlePageSubmit}
            onKeyDown={handleKeyDown}
            className="w-10 h-7 text-center rounded-md border border-border bg-background text-xs font-semibold text-foreground focus:outline-hidden focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span>of <strong className="text-foreground">{maxPages}</strong></span>
        </div>

        <div className="flex items-center gap-1 ml-1">
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous page"
          >
            <ChevronLeft size={14} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= maxPages}
            title="Next page"
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Pagination;
