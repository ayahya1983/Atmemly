import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, useTranslation } from "@/lib/i18n";
import { format } from "date-fns";
import { DataTable, type Column, StatusBadge, PageHeader, FilterBar, ConfirmActionDialog } from "@/components/admin";

interface ContractRow {
  id: number; title: string; status: string;
  clientId: number; freelancerId: number;
  totalAmount: number; currency: string; createdAt: string;
}
interface ListResp { total: number; items: ContractRow[]; }

const ACTIONS = [
  { key: "hold", labelEn: "Hold", labelAr: "إيقاف", destructive: false },
  { key: "cancel", labelEn: "Cancel", labelAr: "إلغاء", destructive: true },
  { key: "mark-disputed", labelEn: "Dispute", labelAr: "نزاع", destructive: false },
] as const;

export default function AdminContracts() {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  const path = `/admin/contracts/search${params.toString() ? `?${params}` : ""}`;
  const key = ["admin-contracts", status];
  const { data, isLoading } = useAdminGet<ListResp>(key, path);

  const actionMutation = useAdminMutation<{ id: number; action: string }>(
    ({ id, action }) => adminApi.post(`/admin/contracts/${id}/${action}`, {}),
    [key],
  );

  const columns: Column<ContractRow>[] = [
    { key: "id", header: "#", cell: (c) => <span className="font-mono text-xs">#{c.id}</span>, sortValue: (c) => c.id },
    {
      key: "title",
      header: lang === "ar" ? "العنوان" : "Title",
      cell: (c) => <span className="font-medium block max-w-xs truncate">{c.title}</span>,
      sortValue: (c) => c.title,
      searchValue: (c) => c.title,
    },
    { key: "clientId", header: lang === "ar" ? "العميل" : "Client", cell: (c) => <span className="text-sm">user#{c.clientId}</span>, sortValue: (c) => c.clientId },
    { key: "freelancerId", header: lang === "ar" ? "المستقل" : "Freelancer", cell: (c) => <span className="text-sm">user#{c.freelancerId}</span>, sortValue: (c) => c.freelancerId },
    {
      key: "totalAmount",
      header: lang === "ar" ? "القيمة" : "Amount",
      align: "end",
      cell: (c) => <span className="tabular-nums">{formatCurrency(c.totalAmount, c.currency, lang)}</span>,
      sortValue: (c) => c.totalAmount,
    },
    { key: "status", header: lang === "ar" ? "الحالة" : "Status", cell: (c) => <StatusBadge status={c.status} />, sortValue: (c) => c.status },
    {
      key: "createdAt",
      header: lang === "ar" ? "تاريخ" : "Date",
      cell: (c) => <span className="text-xs text-muted-foreground">{format(new Date(c.createdAt), "yyyy-MM-dd")}</span>,
      sortValue: (c) => new Date(c.createdAt).getTime(),
    },
    {
      key: "actions",
      header: lang === "ar" ? "إجراءات" : "Actions",
      align: "end",
      cell: (c) => (
        <div className="flex gap-1 justify-end">
          {ACTIONS.map((a) => (
            <ConfirmActionDialog
              key={a.key}
              trigger={
                <Button size="sm" variant={a.destructive ? "destructive" : "outline"} disabled={actionMutation.isPending}>
                  {lang === "ar" ? a.labelAr : a.labelEn}
                </Button>
              }
              title={`${lang === "ar" ? "تأكيد" : "Confirm"} ${lang === "ar" ? a.labelAr : a.labelEn}`}
              description={`${lang === "ar" ? "العقد" : "Contract"} #${c.id}: ${c.title}`}
              destructive={a.destructive}
              onConfirm={() => actionMutation.mutateAsync({ id: c.id, action: a.key }).then(() =>
                toast({ title: `${a.labelEn} #${c.id}` }),
              )}
            />
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={lang === "ar" ? "العقود" : "Contracts"}
        description={data ? (lang === "ar" ? `إجمالي ${data.total}` : `${data.total} total`) : undefined}
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "ابحث بالعنوان" : "Search title"}
        onReset={() => { setSearch(""); setStatus("all"); }}
      >
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">{lang === "ar" ? "كل الحالات" : "All statuses"}</option>
          <option value="active">Active</option>
          <option value="funded">Funded</option>
          <option value="in_progress">In progress</option>
          <option value="on_hold">On hold</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="disputed">Disputed</option>
        </select>
      </FilterBar>
      <DataTable
        data={data?.items}
        columns={columns}
        rowKey={(c) => c.id}
        isLoading={isLoading}
        search={search}
        csvFilename="contracts.csv"
      />
    </div>
  );
}
