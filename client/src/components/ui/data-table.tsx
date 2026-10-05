import * as React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { cn } from '@/lib/utils';

export interface Column<T> {
  /** Unique column identifier (defaults to accessorKey) */
  id?: string;
  /** Header label or custom header React node */
  header: React.ReactNode;
  /** Key on the data object (supports dot notation like 'profile.name') */
  accessorKey?: keyof T | (string & {});
  /** Custom render function for the cell (receives row item and index) */
  cell?: (row: T, index: number) => React.ReactNode;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Optional custom class for header cell (th) */
  headerClassName?: string;
  /** Optional custom class for data cell (td) */
  className?: string;
  /** Optional explicit width */
  width?: string | number;
  /** Optional minimum width */
  minWidth?: string | number;
  /** Optional maximum width */
  maxWidth?: string | number;
  /** Optional inline cell style */
  style?: React.CSSProperties;
}

export interface DataTableProps<T> {
  /** Column definitions */
  columns: Column<T>[];
  /** Array of data items to render */
  data: T[];
  /** Custom row key extractor. Defaults to row.id, row._id, or index */
  keyExtractor?: (row: T, index: number) => string | number;
  /** Loading state flag */
  loading?: boolean;
  /** Number of skeleton rows to render during loading (default 5) */
  loadingRowCount?: number;
  /** Message or component to render when data is empty */
  emptyMessage?: React.ReactNode;
  /** Optional callback fired when a row is clicked */
  onRowClick?: (row: T, index: number) => void;
  /** Optional table element className */
  className?: string;
  /** Optional outer wrapper className */
  wrapperClassName?: string;
  /** Alternate row background coloring */
  striped?: boolean;
  /** Enable built-in pagination bar (default: true) */
  paginate?: boolean;
  /** Default rows per page (default: 10) */
  pageSize?: number;
  /** Available options for rows per page selector */
  pageSizeOptions?: number[];
  /** Controlled page index (1-based) */
  page?: number;
  /** Total item count if using server-side pagination */
  totalCount?: number;
  /** Callback when page index changes */
  onPageChange?: (page: number) => void;
  /** Callback when page size changes */
  onPageSizeChange?: (pageSize: number) => void;
}

function getNestedValue<T>(obj: T, path?: string | number | symbol): unknown {
  if (!obj || path == null) return undefined;
  const pathStr = String(path);
  if (!pathStr.includes('.')) {
    return (obj as Record<string, unknown>)[pathStr];
  }
  return pathStr.split('.').reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  loadingRowCount = 4,
  emptyMessage = 'No data available',
  onRowClick,
  className,
  wrapperClassName,
  striped = false,
  paginate = true,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [5, 10, 25, 50],
  page: externalPage,
  totalCount: externalTotalCount,
  onPageChange: externalOnPageChange,
  onPageSizeChange: externalOnPageSizeChange,
}: DataTableProps<T>) {
  // Column resizing state
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({});
  const resizingRef = React.useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  // Internal pagination state
  const [internalPage, setInternalPage] = React.useState(1);
  const [internalPageSize, setInternalPageSize] = React.useState(initialPageSize);

  const currentPage = externalPage ?? internalPage;
  const currentPageSize = internalPageSize;
  const totalItems = externalTotalCount ?? data.length;
  const totalPages = Math.ceil(totalItems / currentPageSize) || 1;

  const handlePageChange = (newPage: number) => {
    if (externalOnPageChange) {
      externalOnPageChange(newPage);
    } else {
      setInternalPage(newPage);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setInternalPageSize(newSize);
    setInternalPage(1);
    if (externalOnPageSizeChange) {
      externalOnPageSizeChange(newSize);
    }
  };

  // Slice data if using client-side pagination
  const isServerPaginated = externalTotalCount != null && externalOnPageChange != null;
  const paginatedData = isServerPaginated || !paginate
    ? data
    : data.slice((currentPage - 1) * currentPageSize, currentPage * currentPageSize);

  // Column drag-resize handlers
  const handleMouseDown = (e: React.MouseEvent, colKey: string, currentWidth?: string | number) => {
    e.preventDefault();
    e.stopPropagation();
    const thElement = (e.target as HTMLElement).closest('th');
    const startWidth = thElement?.getBoundingClientRect().width || (typeof currentWidth === 'number' ? currentWidth : 120);

    resizingRef.current = {
      key: colKey,
      startX: e.clientX,
      startWidth,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = moveEvent.clientX - resizingRef.current.startX;
      const newWidth = Math.max(70, resizingRef.current.startWidth + diff);
      setColumnWidths((prev) => ({ ...prev, [resizingRef.current!.key]: newWidth }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const getRowKey = (row: T, index: number): string | number => {
    if (keyExtractor) return keyExtractor(row, index);
    const r = row as Record<string, unknown>;
    return (r.id as string | number) ?? (r._id as string | number) ?? (r.projectId as string | number) ?? index;
  };

  const getAlignmentClass = (align?: 'left' | 'center' | 'right') => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  const getColStyle = (col: Column<T>, colKey: string): React.CSSProperties => {
    const resizedWidth = columnWidths[colKey];
    return {
      width: resizedWidth ? `${resizedWidth}px` : col.width,
      minWidth: col.minWidth ?? '90px',
      maxWidth: col.maxWidth,
      ...col.style,
    };
  };

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-md border border-border bg-card shadow-xs flex flex-col',
        wrapperClassName,
      )}
    >
      <div className="overflow-x-auto w-full">
        <Table className={cn('w-full', className)}>
          <TableHeader>
            <TableRow>
              {columns.map((col, index) => {
                const colKey = col.id || String(col.accessorKey || index);
                return (
                  <TableHead
                    key={colKey}
                    style={getColStyle(col, colKey)}
                    className={cn(
                      'relative group py-3 px-4 select-none',
                      getAlignmentClass(col.align),
                      col.headerClassName,
                    )}
                  >
                    <div className="flex items-center justify-between gap-1 pr-2">
                      <span className="truncate">{col.header}</span>
                    </div>

                    {/* Resizable handle divider */}
                    <div
                      onMouseDown={(e) => handleMouseDown(e, colKey, col.width)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/60 active:bg-emerald-500 transition-colors z-10"
                      title="Drag to resize column"
                    />
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: loadingRowCount }).map((_, rowIndex) => (
                <TableRow key={`skeleton-row-${rowIndex}`}>
                  {columns.map((col, colIndex) => (
                    <TableCell
                      key={`skeleton-col-${colIndex}`}
                      className={cn(getAlignmentClass(col.align), col.className)}
                    >
                      <Skeleton className="h-4 w-full max-w-[120px] rounded-sm" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, rowIndex) => {
                const rowKey = getRowKey(row, rowIndex);
                const isClickable = Boolean(onRowClick);

                return (
                  <TableRow
                    key={rowKey}
                    onClick={() => onRowClick?.(row, rowIndex)}
                    className={cn(
                      isClickable && 'cursor-pointer hover:bg-muted/60 transition-colors',
                      striped && rowIndex % 2 === 1 && 'bg-muted/20',
                    )}
                  >
                    {columns.map((col, colIndex) => {
                      const colKey = col.id || String(col.accessorKey || colIndex);
                      let cellContent: React.ReactNode;

                      if (col.cell) {
                        cellContent = col.cell(row, rowIndex);
                      } else if (col.accessorKey) {
                        const val = getNestedValue(row, col.accessorKey);
                        cellContent = val != null ? String(val) : '—';
                      } else {
                        cellContent = null;
                      }

                      return (
                        <TableCell
                          key={colKey}
                          style={getColStyle(col, colKey)}
                          className={cn(getAlignmentClass(col.align), col.className)}
                        >
                          {cellContent}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      {paginate && totalItems > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={currentPageSize}
          pageSizeOptions={pageSizeOptions}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
}
