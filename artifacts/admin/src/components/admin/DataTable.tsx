import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Download, Loader2,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  searchValue?: (row: T) => string;
  className?: string;
  align?: "start" | "center" | "end";
}

export interface BulkAction<T> {
  label: string;
  onRun: (rows: T[]) => Promise<void> | void;
  destructive?: boolean;
}

interface DataTableProps<T> {
  data: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  isLoading?: boolean;
  search?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  enableSelection?: boolean;
  bulkActions?: BulkAction<T>[];
  pageSize?: number;
  pageSizeOptions?: number[];
  csvFilename?: string;
  onCsvExport?: () => void | Promise<void>;
  toolbar?: ReactNode;
}

function buildCsv<T>(rows: T[], columns: Column<T>[]): string {
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const headerLine = columns
    .map((c) => escape(typeof c.header === "string" ? c.header : c.key))
    .join(",");
  const lines = rows.map((r) =>
    columns
      .map((c) => {
        if (c.sortValue) return escape(c.sortValue(r));
        if (c.searchValue) return escape(c.searchValue(r));
        const cell = c.cell(r);
        return escape(typeof cell === "string" || typeof cell === "number" ? cell : "");
      })
      .join(","),
  );
  return [headerLine, ...lines].join("\n");
}

function downloadString(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  isLoading,
  search = "",
  emptyTitle,
  emptyDescription,
  enableSelection = false,
  bulkActions,
  pageSize: initialPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  csvFilename,
  onCsvExport,
  toolbar,
}: DataTableProps<T>) {
  const { lang, isRtl } = useTranslation();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return [] as T[];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((r) =>
      columns.some((c) => {
        if (c.searchValue) return c.searchValue(r).toLowerCase().includes(q);
        const v = c.sortValue?.(r);
        if (v != null) return String(v).toLowerCase().includes(q);
        return false;
      }),
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const allOnPageSelected = slice.length > 0 && slice.every((r) => selected.has(rowKey(r)));
  const someOnPageSelected = slice.some((r) => selected.has(rowKey(r)));

  const togglePageSelection = (checked: boolean) => {
    const next = new Set(selected);
    slice.forEach((r) => {
      if (checked) next.add(rowKey(r));
      else next.delete(rowKey(r));
    });
    setSelected(next);
  };

  const toggleRow = (id: string | number, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const onSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
    }
  };

  const exportCsv = async () => {
    if (onCsvExport) await onCsvExport();
    else {
      const csv = buildCsv(sorted, columns);
      downloadString(csv, csvFilename ?? "export.csv", "text/csv;charset=utf-8");
    }
  };

  const runBulk = async (action: BulkAction<T>) => {
    if (selected.size === 0) return;
    const selRows = sorted.filter((r) => selected.has(rowKey(r)));
    setBulkRunning(true);
    try {
      await action.onRun(selRows);
      setSelected(new Set());
    } finally {
      setBulkRunning(false);
    }
  };

  const ChevronStart = isRtl ? ChevronRight : ChevronLeft;
  const ChevronEnd = isRtl ? ChevronLeft : ChevronRight;

  const colCount = columns.length + (enableSelection ? 1 : 0);

  return (
    <div className="space-y-3">
      {(toolbar || onCsvExport !== undefined || csvFilename || (bulkActions?.length ?? 0) > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {selected.size > 0 && bulkActions && bulkActions.length > 0 ? (
              <>
                <span className="text-sm text-muted-foreground">
                  {lang === "ar" ? `${selected.size} محدّد` : `${selected.size} selected`}
                </span>
                {bulkActions.map((a) => (
                  <Button
                    key={a.label}
                    size="sm"
                    variant={a.destructive ? "destructive" : "outline"}
                    disabled={bulkRunning}
                    onClick={() => runBulk(a)}
                    data-testid={`bulk-${a.label}`}
                  >
                    {bulkRunning && <Loader2 className="w-3 h-3 animate-spin ltr:mr-2 rtl:ml-2" />}
                    {a.label}
                  </Button>
                ))}
              </>
            ) : (
              toolbar
            )}
          </div>
          <div className="flex items-center gap-2">
            {(csvFilename || onCsvExport) && (
              <Button size="sm" variant="outline" onClick={exportCsv} data-testid="button-csv-export">
                <Download className="w-3.5 h-3.5 ltr:mr-1.5 rtl:ml-1.5" />
                {lang === "ar" ? "تصدير CSV" : "Export CSV"}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="rounded-md border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {enableSelection && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
                    onCheckedChange={(c) => togglePageSelection(c === true)}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              {columns.map((c) => {
                const sortable = !!c.sortValue;
                const active = sortKey === c.key;
                const Icon = !active ? ChevronsUpDown : sortDir === "asc" ? ChevronUp : ChevronDown;
                return (
                  <TableHead
                    key={c.key}
                    className={cn(
                      c.align === "end" && "text-end",
                      c.align === "center" && "text-center",
                      c.className,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort(c.key)}
                        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                        data-testid={`sort-${c.key}`}
                      >
                        {c.header}
                        <Icon className={cn("w-3.5 h-3.5", active ? "text-foreground" : "text-muted-foreground")} />
                      </button>
                    ) : (
                      c.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`s-${i}`}>
                  {enableSelection && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                  {columns.map((c) => (
                    <TableCell key={c.key}><Skeleton className="h-4 w-full max-w-[140px]" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : slice.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="p-0">
                  <EmptyState
                    title={emptyTitle ?? (lang === "ar" ? "لا توجد بيانات" : "No results")}
                    description={emptyDescription ?? (search ? (lang === "ar" ? "حاول تغيير معايير البحث." : "Try adjusting your search.") : undefined)}
                  />
                </TableCell>
              </TableRow>
            ) : (
              slice.map((row) => {
                const id = rowKey(row);
                const isSel = selected.has(id);
                return (
                  <TableRow key={id} data-state={isSel ? "selected" : undefined}>
                    {enableSelection && (
                      <TableCell>
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={(c) => toggleRow(id, c === true)}
                          aria-label="Select row"
                        />
                      </TableCell>
                    )}
                    {columns.map((c) => (
                      <TableCell
                        key={c.key}
                        className={cn(
                          c.align === "end" && "text-end",
                          c.align === "center" && "text-center",
                          c.className,
                        )}
                      >
                        {c.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{lang === "ar" ? "صفوف لكل صفحة" : "Rows per page"}</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="ltr:ml-2 rtl:mr-2">
              {lang === "ar"
                ? `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, total)} من ${total}`
                : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, total)} of ${total}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} data-testid="button-page-prev">
              <ChevronStart className="w-4 h-4" />
            </Button>
            <span className="px-2 tabular-nums">{safePage} / {totalPages}</span>
            <Button size="icon" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} data-testid="button-page-next">
              <ChevronEnd className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
