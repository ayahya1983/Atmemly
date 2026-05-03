import { useState } from "react";
import { useAdminListPayments, type Payment } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatCurrency, useTranslation } from "@/lib/i18n";
import { downloadCsv } from "@/lib/api-admin";
import { DataTable, type Column, StatusBadge, PageHeader, FilterBar } from "@/components/admin";

type PaymentRow = Payment;

export default function AdminPayments() {
  const { lang } = useTranslation();
  const { data, isLoading } = useAdminListPayments();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = (data ?? []).filter((p) => statusFilter === "all" || p.status === statusFilter);

  const columns: Column<PaymentRow>[] = [
    {
      key: "createdAt",
      header: lang === "ar" ? "التاريخ" : "Date",
      cell: (p) => <span className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(p.createdAt))} {lang === "ar" ? "مضت" : "ago"}</span>,
      sortValue: (p) => new Date(p.createdAt).getTime(),
    },
    {
      key: "jobTitle",
      header: lang === "ar" ? "الوظيفة" : "Job",
      cell: (p) => <span className="font-medium">{p.jobTitle}</span>,
      sortValue: (p) => p.jobTitle ?? "",
      searchValue: (p) => p.jobTitle ?? "",
    },
    {
      key: "payerName",
      header: lang === "ar" ? "الدافع" : "Payer",
      cell: (p) => p.payerName,
      sortValue: (p) => p.payerName ?? "",
      searchValue: (p) => p.payerName ?? "",
    },
    {
      key: "payeeName",
      header: lang === "ar" ? "المستلم" : "Payee",
      cell: (p) => p.payeeName,
      sortValue: (p) => p.payeeName ?? "",
      searchValue: (p) => p.payeeName ?? "",
    },
    {
      key: "amount",
      header: lang === "ar" ? "القيمة" : "Amount",
      align: "end",
      cell: (p) => <span className="tabular-nums">{formatCurrency(Number(p.amount), p.currency, lang)}</span>,
      sortValue: (p) => Number(p.amount),
    },
    {
      key: "status",
      header: lang === "ar" ? "الحالة" : "Status",
      cell: (p) => <StatusBadge status={p.status} />,
      sortValue: (p) => p.status,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={lang === "ar" ? "سجل الدفعات" : "Payments Record"} />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "ابحث في الوظيفة أو الأطراف" : "Search job or parties"}
        onReset={() => { setSearch(""); setStatusFilter("all"); }}
      >
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          data-testid="select-status"
        >
          <option value="all">{lang === "ar" ? "كل الحالات" : "All statuses"}</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="refunded">Refunded</option>
          <option value="failed">Failed</option>
        </select>
      </FilterBar>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        search={search}
        onCsvExport={() => {
          const params = new URLSearchParams();
          if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
          if (search.trim()) params.set("q", search.trim());
          const qs = params.toString();
          return downloadCsv(`/admin/payments.csv${qs ? `?${qs}` : ""}`, "payments.csv");
        }}
      />
    </div>
  );
}
