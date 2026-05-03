import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { DataTable, type Column, StatusBadge, PageHeader, FilterBar, ConfirmActionDialog } from "@/components/admin";

interface ClientRow {
  userId: number;
  email: string;
  fullName: string;
  status: string;
  companyName: string | null;
  verificationStatus: string;
  qualityScore: number;
  totalSpend: number;
  createdAt: string;
}
interface ListResp { total: number; items: ClientRow[]; }

export default function AdminClients() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const canApprove = hasPermission(user, "clients", "approve");
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [verification, setVerification] = useState("all");
  const [status, setStatus] = useState("all");

  const params = new URLSearchParams();
  if (verification !== "all") params.set("verificationStatus", verification);
  if (status !== "all") params.set("status", status);
  const path = `/admin/clients${params.toString() ? `?${params}` : ""}`;
  const key = ["admin-clients", verification, status];
  const { data, isLoading } = useAdminGet<ListResp>(key, path);

  const verifyMutation = useAdminMutation<{ userId: number; decision: "approved" | "rejected" }>(
    ({ userId, decision }) => adminApi.post(`/admin/clients/${userId}/verify`, { decision }),
    [key],
  );

  const verifyAction = (c: ClientRow, decision: "approved" | "rejected") => () =>
    verifyMutation.mutateAsync({ userId: c.userId, decision }).then(() =>
      toast({ title: lang === "ar" ? (decision === "approved" ? "تم الاعتماد" : "تم الرفض") : `Client ${decision}` }),
    );

  const columns: Column<ClientRow>[] = [
    {
      key: "fullName",
      header: lang === "ar" ? "الاسم" : "Name",
      cell: (c) => <span className="font-medium">{c.fullName}</span>,
      sortValue: (c) => c.fullName,
      searchValue: (c) => c.fullName,
    },
    {
      key: "companyName",
      header: lang === "ar" ? "الشركة" : "Company",
      cell: (c) => c.companyName ?? "—",
      sortValue: (c) => c.companyName ?? "",
      searchValue: (c) => c.companyName ?? "",
    },
    {
      key: "email",
      header: lang === "ar" ? "البريد" : "Email",
      cell: (c) => <span className="text-sm text-muted-foreground">{c.email}</span>,
      sortValue: (c) => c.email,
      searchValue: (c) => c.email,
    },
    {
      key: "totalSpend",
      header: lang === "ar" ? "الإنفاق" : "Total Spend",
      align: "end",
      cell: (c) => <span className="tabular-nums">{formatCurrency(c.totalSpend, "AED", lang)}</span>,
      sortValue: (c) => c.totalSpend,
    },
    {
      key: "verificationStatus",
      header: lang === "ar" ? "التحقق" : "Verification",
      cell: (c) => <StatusBadge status={c.verificationStatus} />,
      sortValue: (c) => c.verificationStatus,
    },
    {
      key: "actions",
      header: lang === "ar" ? "إجراءات" : "Actions",
      align: "end",
      cell: (c) => !canApprove ? null : (
        <div className="flex gap-1 justify-end">
          <ConfirmActionDialog
            trigger={
              <Button size="sm" disabled={verifyMutation.isPending || c.verificationStatus === "approved"}>
                {lang === "ar" ? "اعتماد" : "Approve"}
              </Button>
            }
            title={lang === "ar" ? "اعتماد العميل؟" : "Approve client?"}
            description={c.fullName}
            onConfirm={verifyAction(c, "approved")}
          />
          <ConfirmActionDialog
            trigger={
              <Button size="sm" variant="destructive" disabled={verifyMutation.isPending || c.verificationStatus === "rejected"}>
                {lang === "ar" ? "رفض" : "Reject"}
              </Button>
            }
            title={lang === "ar" ? "رفض العميل؟" : "Reject client?"}
            description={c.fullName}
            destructive
            onConfirm={verifyAction(c, "rejected")}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={lang === "ar" ? "العملاء" : "Clients"}
        description={data ? (lang === "ar" ? `إجمالي ${data.total}` : `${data.total} total`) : undefined}
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "ابحث بالاسم/الشركة/البريد" : "Search name, company, email"}
        onReset={() => { setSearch(""); setVerification("all"); setStatus("all"); }}
      >
        <select value={verification} onChange={(e) => setVerification(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">{lang === "ar" ? "كل التحقق" : "All verification"}</option>
          <option value="not_submitted">Not submitted</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">{lang === "ar" ? "كل الحالات" : "All statuses"}</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </FilterBar>
      <DataTable
        data={data?.items}
        columns={columns}
        rowKey={(c) => c.userId}
        isLoading={isLoading}
        search={search}
        csvFilename="clients.csv"
      />
    </div>
  );
}
