import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi, downloadCsv } from "@/lib/api-admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, useTranslation } from "@/lib/i18n";
import { format } from "date-fns";
import { Download } from "lucide-react";

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{lang === "ar" ? "دفعات الصرف" : "Payout Batches"}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{lang === "ar" ? "إنشاء دفعة جديدة" : "Create New Batch"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{lang === "ar" ? "العملة" : "Currency"}</label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="w-24" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{lang === "ar" ? "الحد الأدنى" : "Min Amount"}</label>
              <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="w-32" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted-foreground block mb-1">{lang === "ar" ? "ملاحظة" : "Note"}</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {lang === "ar" ? "إنشاء" : "Create Batch"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{lang === "ar" ? "العملة" : "Currency"}</TableHead>
              <TableHead>{lang === "ar" ? "القيمة" : "Total"}</TableHead>
              <TableHead>{lang === "ar" ? "العناصر" : "Items"}</TableHead>
              <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
              <TableHead>{lang === "ar" ? "تاريخ" : "Date"}</TableHead>
              <TableHead>{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7}><Skeleton className="h-8" /></TableCell></TableRow>
            ) : !data?.data.length ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{lang === "ar" ? "لا دفعات" : "No batches yet"}</TableCell></TableRow>
            ) : (
              data.data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">#{b.id}</TableCell>
                  <TableCell>{b.currency}</TableCell>
                  <TableCell>{formatCurrency(Number(b.totalAmount), b.currency, lang)}</TableCell>
                  <TableCell>{b.itemCount}</TableCell>
                  <TableCell><Badge variant={b.status === "completed" ? "default" : "outline"} className="capitalize">{b.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(b.createdAt), "yyyy-MM-dd HH:mm")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => downloadCsv(`/admin/payout-batches/${b.id}/export.csv`, `batch-${b.id}.csv`)}>
                        <Download className="w-3 h-3 mr-1" />CSV
                      </Button>
                      {b.status === "draft" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm">{lang === "ar" ? "معالجة" : "Process"}</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{lang === "ar" ? "تأكيد المعالجة" : "Confirm Processing"}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {lang === "ar" ? `سيتم وضع علامة "مكتمل" على ${b.itemCount} عنصر بقيمة` : `This will mark ${b.itemCount} payouts complete totalling`} {formatCurrency(Number(b.totalAmount), b.currency, lang)}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{lang === "ar" ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => processMutation.mutate({ id: b.id }, {
                                onSuccess: () => toast({ title: lang === "ar" ? "تمت معالجة الدفعة" : `Batch #${b.id} processed` }),
                                onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
                              })}>{lang === "ar" ? "تأكيد" : "Process"}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
