import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";
import { DataTable, type Column, StatusBadge, PageHeader, FilterBar, ConfirmActionDialog } from "@/components/admin";

interface VerificationRow {
  id: number;
  userId: number;
  userName: string | null;
  userRole: string | null;
  kind: string;
  status: string;
  documentUrls: string[] | null;
  fullLegalName: string | null;
  documentNumber: string | null;
  notes: string | null;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export default function AdminVerifications() {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const path = filter === "all" ? "/admin/verifications" : `/admin/verifications?status=${filter}`;
  const key = ["admin-verifications", filter];
  const { data, isLoading } = useAdminGet<VerificationRow[]>(key, path);

  const decisionMutation = useAdminMutation<{ id: number; decision: "approve" | "reject"; reason?: string }>(
    ({ id, decision, reason }) =>
      adminApi.post(`/admin/verifications/${id}/${decision}`, reason ? { reason } : {}),
    [key, ["admin-dashboard"]],
  );

  const columns: Column<VerificationRow>[] = [
    { key: "id", header: "#", cell: (v) => <span className="font-mono text-xs">#{v.id}</span>, sortValue: (v) => v.id },
    {
      key: "user",
      header: lang === "ar" ? "المستخدم" : "User",
      cell: (v) => (
        <div>
          <div className="font-medium">{v.userName ?? `user#${v.userId}`}</div>
          <div className="text-xs text-muted-foreground capitalize">{v.userRole ?? "—"}</div>
        </div>
      ),
      sortValue: (v) => v.userName ?? "",
      searchValue: (v) => `${v.userName ?? ""} ${v.userRole ?? ""}`,
    },
    { key: "kind", header: lang === "ar" ? "النوع" : "Kind", cell: (v) => <StatusBadge status={v.kind} tone="info" />, sortValue: (v) => v.kind },
    {
      key: "fullLegalName",
      header: lang === "ar" ? "الاسم القانوني" : "Legal Name",
      cell: (v) => <span className="text-sm">{v.fullLegalName ?? "—"}</span>,
      searchValue: (v) => v.fullLegalName ?? "",
    },
    { key: "status", header: lang === "ar" ? "الحالة" : "Status", cell: (v) => <StatusBadge status={v.status} />, sortValue: (v) => v.status },
    {
      key: "submittedAt",
      header: lang === "ar" ? "تاريخ" : "Submitted",
      cell: (v) => <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(v.submittedAt))} {lang === "ar" ? "مضت" : "ago"}</span>,
      sortValue: (v) => new Date(v.submittedAt).getTime(),
    },
    {
      key: "actions",
      header: lang === "ar" ? "إجراءات" : "Actions",
      align: "end",
      cell: (v) => v.status !== "pending" ? <span className="text-xs text-muted-foreground">{lang === "ar" ? "مغلق" : "Closed"}</span> : (
        <VerificationDecideDialog v={v} pending={decisionMutation.isPending} onDecide={async (decision, reason) => {
          await decisionMutation.mutateAsync({ id: v.id, decision, reason });
          toast({ title: lang === "ar" ? "تم الحفظ" : `Verification ${decision}d` });
        }} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={lang === "ar" ? "طلبات التحقق KYC" : "KYC Verifications"} />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "ابحث بالمستخدم/الاسم" : "Search user or name"}
        onReset={() => { setSearch(""); setFilter("pending"); }}
      >
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">{lang === "ar" ? "كل الحالات" : "All"}</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </FilterBar>
      <DataTable
        data={data}
        columns={columns}
        rowKey={(v) => v.id}
        isLoading={isLoading}
        search={search}
        csvFilename="verifications.csv"
      />
    </div>
  );
}

function VerificationDecideDialog({ v, onDecide, pending }: {
  v: VerificationRow;
  pending: boolean;
  onDecide: (decision: "approve" | "reject", reason?: string) => Promise<void>;
}) {
  const { lang } = useTranslation();
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject">("approve");

  return (
    <ConfirmActionDialog
      trigger={<Button size="sm" variant="outline">{lang === "ar" ? "مراجعة" : "Review"}</Button>}
      title={`${lang === "ar" ? "مراجعة طلب التحقق" : "Review Verification"} #${v.id}`}
      confirmLabel={decision === "approve" ? (lang === "ar" ? "اعتماد" : "Approve") : (lang === "ar" ? "رفض" : "Reject")}
      destructive={decision === "reject"}
      onConfirm={() => onDecide(decision, decision === "reject" ? (reason || undefined) : undefined)}
      body={
        <div className="space-y-3 text-sm">
          <div><strong>{lang === "ar" ? "المستخدم:" : "User:"}</strong> {v.userName ?? `user#${v.userId}`}</div>
          <div><strong>{lang === "ar" ? "النوع:" : "Kind:"}</strong> {v.kind}</div>
          <div><strong>{lang === "ar" ? "الاسم القانوني:" : "Legal name:"}</strong> {v.fullLegalName ?? "—"}</div>
          <div><strong>{lang === "ar" ? "رقم الوثيقة:" : "Document #:"}</strong> {v.documentNumber ?? "—"}</div>
          {v.notes && <div><strong>{lang === "ar" ? "ملاحظات:" : "Notes:"}</strong> {v.notes}</div>}
          {v.documentUrls && v.documentUrls.length > 0 && (
            <div>
              <strong>{lang === "ar" ? "المستندات:" : "Documents:"}</strong>
              <div className="space-y-1 mt-1">
                {v.documentUrls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="block text-primary text-xs underline truncate">{u}</a>
                ))}
              </div>
            </div>
          )}
          <div>
            <Label className="block mb-1">{lang === "ar" ? "القرار" : "Decision"}</Label>
            <select value={decision} onChange={(e) => setDecision(e.target.value as "approve" | "reject")} disabled={pending} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="approve">{lang === "ar" ? "اعتماد" : "Approve"}</option>
              <option value="reject">{lang === "ar" ? "رفض" : "Reject"}</option>
            </select>
          </div>
          {decision === "reject" && (
            <div>
              <Label className="block mb-1">{lang === "ar" ? "سبب الرفض" : "Rejection reason"}</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} disabled={pending} />
            </div>
          )}
        </div>
      }
    />
  );
}
