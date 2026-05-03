import { useState } from "react";
import { useAdminGet, downloadCsv } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { format } from "date-fns";
import { Eye } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DataTable, type Column, PageHeader, FilterBar,
} from "@/components/admin";

interface AuditRow {
  id: number;
  userId: number | null;
  userName: string | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export default function AdminAuditLogs() {
  const { lang } = useTranslation();
  const [actionInput, setActionInput] = useState("");
  const [entityInput, setEntityInput] = useState("");
  const [applied, setApplied] = useState({ action: "", entityType: "" });
  const [search, setSearch] = useState("");

  const params = new URLSearchParams();
  if (applied.action) params.set("action", applied.action);
  if (applied.entityType) params.set("entityType", applied.entityType);
  params.set("limit", "200");
  const path = `/admin/audit-logs?${params}`;
  const csvPath = `/admin/audit-logs.csv?${params}`;

  const { data, isLoading } = useAdminGet<AuditRow[]>(
    ["admin-audit-logs", applied.action, applied.entityType], path,
  );
  const [viewing, setViewing] = useState<AuditRow | null>(null);

  const columns: Column<AuditRow>[] = [
    {
      key: "createdAt",
      header: lang === "ar" ? "الوقت" : "Time",
      cell: (r) => <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(r.createdAt), "yyyy-MM-dd HH:mm:ss")}</span>,
      sortValue: (r) => new Date(r.createdAt).getTime(),
    },
    {
      key: "userName",
      header: lang === "ar" ? "المستخدم" : "User",
      cell: (r) => <span className="text-sm">{r.userName ?? (r.userId ? `user#${r.userId}` : "—")}</span>,
      sortValue: (r) => r.userName ?? (r.userId ? `user#${r.userId}` : ""),
      searchValue: (r) => `${r.userName ?? ""} ${r.userId ?? ""}`,
    },
    {
      key: "action",
      header: lang === "ar" ? "الإجراء" : "Action",
      cell: (r) => <Badge variant="outline" className="font-mono text-xs">{r.action}</Badge>,
      sortValue: (r) => r.action,
      searchValue: (r) => r.action,
    },
    {
      key: "entity",
      header: lang === "ar" ? "الكيان" : "Entity",
      cell: (r) => <span className="text-sm">{r.entityType ? `${r.entityType}#${r.entityId ?? "?"}` : "—"}</span>,
      sortValue: (r) => `${r.entityType ?? ""}${r.entityId ?? ""}`,
      searchValue: (r) => `${r.entityType ?? ""} ${r.entityId ?? ""}`,
    },
    {
      key: "ip",
      header: "IP",
      cell: (r) => <span className="text-xs text-muted-foreground">{r.ip ?? "—"}</span>,
      sortValue: (r) => r.ip ?? "",
      searchValue: (r) => r.ip ?? "",
    },
    {
      key: "view",
      header: "",
      align: "end",
      cell: (r) => (
        <Button size="sm" variant="ghost" onClick={() => setViewing(r)} data-testid={`button-view-${r.id}`}>
          <Eye className="w-3 h-3" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={lang === "ar" ? "سجل التدقيق" : "Audit Logs"} />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "ابحث (مستخدم، إجراء، كيان، IP)" : "Search (user, action, entity, IP)"}
        onReset={() => {
          setSearch(""); setActionInput(""); setEntityInput("");
          setApplied({ action: "", entityType: "" });
        }}
      >
        <input
          value={actionInput}
          onChange={(e) => setActionInput(e.target.value)}
          placeholder={lang === "ar" ? "نوع الإجراء" : "Action filter"}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm w-44"
          data-testid="input-action-filter"
        />
        <input
          value={entityInput}
          onChange={(e) => setEntityInput(e.target.value)}
          placeholder={lang === "ar" ? "نوع الكيان" : "Entity filter"}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm w-40"
          data-testid="input-entity-filter"
        />
        <Button size="sm" variant="outline" onClick={() => setApplied({ action: actionInput, entityType: entityInput })} data-testid="button-apply-filter">
          {lang === "ar" ? "تطبيق" : "Apply"}
        </Button>
      </FilterBar>
      <DataTable
        data={data}
        columns={columns}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        search={search}
        emptyTitle={lang === "ar" ? "لا سجلات" : "No audit logs"}
        csvFilename="audit-logs.csv"
        onCsvExport={() => downloadCsv(csvPath, "audit-logs.csv")}
      />

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{lang === "ar" ? "تفاصيل السجل" : "Audit Log Details"} #{viewing?.id}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-2 text-sm">
              <div><strong>Action:</strong> <code>{viewing.action}</code></div>
              <div><strong>Entity:</strong> {viewing.entityType ?? "—"}#{viewing.entityId ?? "?"}</div>
              <div><strong>User:</strong> {viewing.userName ?? "—"} {viewing.userId ? `(#${viewing.userId})` : ""}</div>
              <div><strong>IP:</strong> {viewing.ip ?? "—"}</div>
              <div><strong>User-Agent:</strong> <span className="text-xs text-muted-foreground break-all">{viewing.userAgent ?? "—"}</span></div>
              <div><strong>Time:</strong> {format(new Date(viewing.createdAt), "yyyy-MM-dd HH:mm:ss")}</div>
              <div>
                <strong>Metadata:</strong>
                <pre className="bg-muted rounded p-3 text-xs mt-1 overflow-auto max-h-64">{JSON.stringify(viewing.metadata ?? {}, null, 2)}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
