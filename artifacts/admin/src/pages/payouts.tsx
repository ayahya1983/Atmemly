import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi, downloadCsv } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, useTranslation } from "@/lib/i18n";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { DataTable, type Column, StatusBadge, PageHeader, FilterBar, ConfirmActionDialog } from "@/components/admin";

interface BatchRow {
  id: number;
  status: string;
  currency: string;
  totalAmount: string;
  itemCount: number;
  note: string | null;
  createdAt: string;
}
interface ListResp { data: BatchRow[]; pagination: { total: number; page: number; perPage: number }; }

export default function AdminPayouts() {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const [minAmount, setMinAmount] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");

  const key = ["admin-payout-batches"];
  const { data, isLoading } = useAdminGet<ListResp>(key, "/admin/payout-batches?perPage=50");

  const createMutation = useAdminMutation<{ minAmount?: number; currency: string; note?: string }>(
    (input) => adminApi.post("/admin/payout-batches", input),
    [key],
  );
  const processMutation = useAdminMutation<{ id: number }>(
    ({ id }) => adminApi.post(`/admin/payout-batches/${id}/process`, {}),
    [key],
  );

  const handleCreate = () => {
    const body: { minAmount?: number; currency: string; note?: string } = { currency };
    if (minAmount) body.minAmount = Number(minAmount);
    if (note) body.note = note;
    createMutation.mutate(body, {
      onSuccess: (b: any) => {
        toast({ title: lang === "ar" ? "تم إنشاء دفعة" : `Batch #${b?.id ?? ""} created` });
        setMinAmount(""); setNote("");
      },
      onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
    });
  };

  const columns: Column<BatchRow>[] = [
    { key: "id", header: "#", cell: (b) => <span className="font-mono text-xs">#{b.id}</span>, sortValue: (b) => b.id },
    { key: "currency", header: lang === "ar" ? "العملة" : "Currency", cell: (b) => b.currency, sortValue: (b) => b.currency },
    {
      key: "totalAmount",
      header: lang === "ar" ? "القيمة" : "Total",
      align: "end",
      cell: (b) => <span className="tabular-nums">{formatCurrency(Number(b.totalAmount), b.currency, lang)}</span>,
      sortValue: (b) => Number(b.totalAmount),
    },
    { key: "itemCount", header: lang === "ar" ? "العناصر" : "Items", align: "end", cell: (b) => b.itemCount, sortValue: (b) => b.itemCount },
    { key: "status", header: lang === "ar" ? "الحالة" : "Status", cell: (b) => <StatusBadge status={b.status} />, sortValue: (b) => b.status },
    {
      key: "createdAt",
      header: lang === "ar" ? "تاريخ" : "Date",
      cell: (b) => <span className="text-xs text-muted-foreground">{format(new Date(b.createdAt), "yyyy-MM-dd HH:mm")}</span>,
      sortValue: (b) => new Date(b.createdAt).getTime(),
    },
    {
      key: "actions",
      header: lang === "ar" ? "إجراءات" : "Actions",
      align: "end",
      cell: (b) => (
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="outline" onClick={() => downloadCsv(`/admin/payout-batches/${b.id}/export.csv`, `batch-${b.id}.csv`)}>
            <Download className="w-3 h-3 ltr:mr-1 rtl:ml-1" />CSV
          </Button>
          {b.status === "draft" && (
            <ConfirmActionDialog
              trigger={<Button size="sm" disabled={processMutation.isPending}>{lang === "ar" ? "معالجة" : "Process"}</Button>}
              title={lang === "ar" ? "تأكيد المعالجة" : "Confirm processing"}
              description={`${lang === "ar" ? `سيتم وضع علامة "مكتمل" على ${b.itemCount} عنصر` : `Mark ${b.itemCount} payouts complete`} — ${formatCurrency(Number(b.totalAmount), b.currency, lang)}`}
              confirmLabel={lang === "ar" ? "تأكيد" : "Process"}
              onConfirm={() => processMutation.mutateAsync({ id: b.id }).then(() => toast({ title: `Batch #${b.id} processed` }))}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={lang === "ar" ? "دفعات الصرف" : "Payout Batches"} />

      <Card>
        <CardHeader><CardTitle className="text-base">{lang === "ar" ? "إنشاء دفعة جديدة" : "Create new batch"}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{lang === "ar" ? "العملة" : "Currency"}</label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="w-24" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{lang === "ar" ? "الحد الأدنى" : "Min amount"}</label>
              <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="w-32" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted-foreground block mb-1">{lang === "ar" ? "ملاحظة" : "Note"}</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {lang === "ar" ? "إنشاء" : "Create batch"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "ابحث في الدفعات" : "Search batches"}
        onReset={() => setSearch("")}
      />
      <DataTable
        data={data?.data}
        columns={columns}
        rowKey={(b) => b.id}
        isLoading={isLoading}
        search={search}
        csvFilename="payout-batches.csv"
      />
    </div>
  );
}
