import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { formatDistanceToNow } from "date-fns";
import { DataTable, type Column, StatusBadge, PageHeader, FilterBar, ConfirmActionDialog } from "@/components/admin";

interface DisputeRow {
  id: number;
  contractId: number;
  raisedById: number;
  raisedAgainstId: number;
  status: string;
  reason: string;
  resolutionNotes?: string | null;
  createdAt: string;
}

export default function AdminDisputes() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "disputes", "write");
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const path = filter === "all" ? "/admin/disputes" : `/admin/disputes?status=${filter}`;
  const key = ["admin-disputes", filter];
  const { data, isLoading } = useAdminGet<DisputeRow[]>(key, path);

  const updateMutation = useAdminMutation<{ id: number; status: string; resolutionNotes?: string }>(
    ({ id, status, resolutionNotes }) => adminApi.patch(`/admin/disputes/${id}`, { status, resolutionNotes }),
    [key],
  );

  const columns: Column<DisputeRow>[] = [
    { key: "id", header: "#", cell: (d) => <span className="font-mono text-xs">#{d.id}</span>, sortValue: (d) => d.id },
    { key: "contractId", header: lang === "ar" ? "العقد" : "Contract", cell: (d) => <span className="font-mono text-xs">#{d.contractId}</span>, sortValue: (d) => d.contractId },
    {
      key: "reason",
      header: lang === "ar" ? "السبب" : "Reason",
      cell: (d) => <span className="block max-w-xs truncate text-sm">{d.reason}</span>,
      searchValue: (d) => d.reason,
    },
    { key: "status", header: lang === "ar" ? "الحالة" : "Status", cell: (d) => <StatusBadge status={d.status} />, sortValue: (d) => d.status },
    {
      key: "createdAt",
      header: lang === "ar" ? "تاريخ" : "Created",
      cell: (d) => <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(d.createdAt))} {lang === "ar" ? "مضت" : "ago"}</span>,
      sortValue: (d) => new Date(d.createdAt).getTime(),
    },
    {
      key: "actions",
      header: lang === "ar" ? "إجراءات" : "Actions",
      align: "end",
      cell: (d) => !canWrite ? null : <DisputeManageDialog dispute={d} pending={updateMutation.isPending} onSave={async (s, n) => {
        await updateMutation.mutateAsync({ id: d.id, status: s, resolutionNotes: n });
        toast({ title: lang === "ar" ? "تم التحديث" : "Updated" });
      }} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={lang === "ar" ? "النزاعات" : "Disputes"} />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "ابحث في السبب" : "Search reason"}
        onReset={() => { setSearch(""); setFilter("all"); }}
      >
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">{lang === "ar" ? "كل الحالات" : "All"}</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>
      </FilterBar>
      <DataTable
        data={data}
        columns={columns}
        rowKey={(d) => d.id}
        isLoading={isLoading}
        search={search}
        csvFilename="disputes.csv"
      />
    </div>
  );
}

function DisputeManageDialog({ dispute, onSave, pending }: {
  dispute: DisputeRow;
  pending: boolean;
  onSave: (status: string, notes: string | undefined) => Promise<void>;
}) {
  const { lang } = useTranslation();
  const [status, setStatus] = useState(dispute.status);
  const [notes, setNotes] = useState(dispute.resolutionNotes ?? "");

  return (
    <ConfirmActionDialog
      trigger={<Button size="sm" variant="outline">{lang === "ar" ? "إدارة" : "Manage"}</Button>}
      title={`${lang === "ar" ? "إدارة النزاع" : "Manage Dispute"} #${dispute.id}`}
      description={dispute.reason}
      confirmLabel={lang === "ar" ? "حفظ" : "Save"}
      onConfirm={() => onSave(status, notes || undefined)}
      body={
        <div className="space-y-4">
          <div>
            <Label className="block mb-1">{lang === "ar" ? "الحالة" : "Status"}</Label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" disabled={pending}>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <Label className="block mb-1">{lang === "ar" ? "ملاحظات الحل" : "Resolution Notes"}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} disabled={pending} />
          </div>
        </div>
      }
    />
  );
}
