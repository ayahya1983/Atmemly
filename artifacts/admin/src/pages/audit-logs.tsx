import { useState } from "react";
import { PageHeader } from "@/components/admin";
import { useAdminGet, downloadCsv } from "@/lib/api-admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";
import { format } from "date-fns";
import { Download, Eye } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

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
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [search, setSearch] = useState({ action: "", entityType: "" });

  const params = new URLSearchParams();
  if (search.action) params.set("action", search.action);
  if (search.entityType) params.set("entityType", search.entityType);
  params.set("limit", "200");
  const path = `/admin/audit-logs?${params}`;
  const csvPath = `/admin/audit-logs.csv?${params}`;

  const { data, isLoading } = useAdminGet<AuditRow[]>(["admin-audit-logs", search.action, search.entityType], path);

  const [viewing, setViewing] = useState<AuditRow | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader title={lang === "ar" ? "سجل التدقيق" : "Audit Logs"} />
        <Button variant="outline" onClick={() => downloadCsv(csvPath, "audit-logs.csv")}>
          <Download className="w-4 h-4 mr-2" />{lang === "ar" ? "تصدير CSV" : "Export CSV"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder={lang === "ar" ? "نوع الإجراء (مثل user.update)" : "Action (e.g. user.update)"} value={action} onChange={(e) => setAction(e.target.value)} className="max-w-xs" />
        <Input placeholder={lang === "ar" ? "نوع الكيان" : "Entity type"} value={entityType} onChange={(e) => setEntityType(e.target.value)} className="max-w-xs" />
        <Button variant="outline" onClick={() => setSearch({ action, entityType })}>{lang === "ar" ? "تصفية" : "Filter"}</Button>
        <Button variant="ghost" onClick={() => { setAction(""); setEntityType(""); setSearch({ action: "", entityType: "" }); }}>{lang === "ar" ? "مسح" : "Clear"}</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{lang === "ar" ? "الوقت" : "Time"}</TableHead>
              <TableHead>{lang === "ar" ? "المستخدم" : "User"}</TableHead>
              <TableHead>{lang === "ar" ? "الإجراء" : "Action"}</TableHead>
              <TableHead>{lang === "ar" ? "الكيان" : "Entity"}</TableHead>
              <TableHead>IP</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-8" /></TableCell></TableRow>
              : !data?.length ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{lang === "ar" ? "لا سجلات" : "No audit logs"}</TableCell></TableRow>
              : data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(row.createdAt), "yyyy-MM-dd HH:mm:ss")}</TableCell>
                  <TableCell className="text-sm">{row.userName ?? (row.userId ? `user#${row.userId}` : "—")}</TableCell>
                  <TableCell><Badge variant="outline" className="font-mono text-xs">{row.action}</Badge></TableCell>
                  <TableCell className="text-sm">{row.entityType ? `${row.entityType}#${row.entityId ?? "?"}` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.ip ?? "—"}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => setViewing(row)}><Eye className="w-3 h-3" /></Button></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

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
