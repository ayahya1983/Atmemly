import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { DataTable, type Column, StatusBadge, PageHeader, FilterBar, ConfirmActionDialog } from "@/components/admin";

interface FreelancerRow {
  userId: number;
  email: string;
  fullName: string;
  status: string;
  headline: string | null;
  verificationStatus: string;
  trustScore: number;
  createdAt: string;
}
interface ListResp { total: number; items: FreelancerRow[]; }

export default function AdminFreelancers() {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [verification, setVerification] = useState("all");
  const [status, setStatus] = useState("all");

  const params = new URLSearchParams();
  if (verification !== "all") params.set("verificationStatus", verification);
  if (status !== "all") params.set("status", status);
  const qs = params.toString();
  const path = `/admin/freelancers${qs ? `?${qs}` : ""}`;
  const key = ["admin-freelancers", verification, status];
  const { data, isLoading } = useAdminGet<ListResp>(key, path);

  const trustMutation = useAdminMutation<{ userId: number; delta: number }>(
    ({ userId, delta }) => adminApi.patch(`/admin/freelancers/${userId}/trust-score`, { delta }),
    [key],
  );
  const visibilityMutation = useAdminMutation<{ userId: number; hidden: boolean }>(
    ({ userId, hidden }) => adminApi.patch(`/admin/freelancers/${userId}/visibility`, { hidden }),
    [key],
  );

  const adjustTrust = (f: FreelancerRow, delta: number) => {
    trustMutation.mutate({ userId: f.userId, delta }, {
      onSuccess: () => toast({ title: `${lang === "ar" ? "تم تعديل الثقة" : "Trust"} ${delta > 0 ? "+" : ""}${delta}` }),
      onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
    });
  };

  const columns: Column<FreelancerRow>[] = [
    {
      key: "fullName",
      header: lang === "ar" ? "الاسم" : "Name",
      cell: (f) => <span className="font-medium">{f.fullName}</span>,
      sortValue: (f) => f.fullName,
      searchValue: (f) => f.fullName,
    },
    {
      key: "email",
      header: lang === "ar" ? "البريد" : "Email",
      cell: (f) => <span className="text-sm text-muted-foreground">{f.email}</span>,
      sortValue: (f) => f.email,
      searchValue: (f) => f.email,
    },
    {
      key: "headline",
      header: lang === "ar" ? "العنوان" : "Headline",
      cell: (f) => <span className="block max-w-xs truncate text-sm">{f.headline ?? "—"}</span>,
      searchValue: (f) => f.headline ?? "",
    },
    {
      key: "verificationStatus",
      header: lang === "ar" ? "التحقق" : "KYC",
      cell: (f) => <StatusBadge status={f.verificationStatus} />,
      sortValue: (f) => f.verificationStatus,
    },
    {
      key: "trustScore",
      header: lang === "ar" ? "الثقة" : "Trust",
      align: "end",
      cell: (f) => <span className="font-mono tabular-nums">{f.trustScore}</span>,
      sortValue: (f) => f.trustScore,
    },
    {
      key: "status",
      header: lang === "ar" ? "الحالة" : "Status",
      cell: (f) => <StatusBadge status={f.status} />,
      sortValue: (f) => f.status,
    },
    {
      key: "actions",
      header: lang === "ar" ? "إجراءات" : "Actions",
      align: "end",
      cell: (f) => (
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="outline" disabled={trustMutation.isPending} onClick={() => adjustTrust(f, 5)}>+5</Button>
          <Button size="sm" variant="outline" disabled={trustMutation.isPending} onClick={() => adjustTrust(f, -5)}>-5</Button>
          <ConfirmActionDialog
            trigger={
              <Button size="sm" variant={f.status === "active" ? "destructive" : "default"} disabled={visibilityMutation.isPending}>
                {f.status === "active" ? (lang === "ar" ? "إخفاء" : "Hide") : (lang === "ar" ? "إظهار" : "Show")}
              </Button>
            }
            title={f.status === "active" ? (lang === "ar" ? "إخفاء المستقل؟" : "Hide freelancer?") : (lang === "ar" ? "إظهار المستقل؟" : "Show freelancer?")}
            description={f.fullName}
            destructive={f.status === "active"}
            onConfirm={() => visibilityMutation.mutateAsync({ userId: f.userId, hidden: f.status === "active" })}
            successMessage={lang === "ar" ? "تم التحديث" : "Updated"}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={lang === "ar" ? "المستقلون" : "Freelancers"}
        description={data ? (lang === "ar" ? `إجمالي ${data.total}` : `${data.total} total`) : undefined}
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "ابحث بالاسم أو البريد" : "Search name or email"}
        onReset={() => { setSearch(""); setVerification("all"); setStatus("all"); }}
      >
        <select value={verification} onChange={(e) => setVerification(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">{lang === "ar" ? "كل التحقق" : "All KYC"}</option>
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
        rowKey={(f) => f.userId}
        isLoading={isLoading}
        search={search}
        csvFilename="freelancers.csv"
      />
    </div>
  );
}
