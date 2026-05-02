import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, useTranslation } from "@/lib/i18n";
import { format } from "date-fns";

interface ContractRow {
  id: number; title: string; status: string;
  clientId: number; freelancerId: number;
  totalAmount: number; currency: string; createdAt: string;
}
interface ListResp { total: number; items: ContractRow[]; }

export default function AdminContracts() {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (status !== "all") params.set("status", status);
  const path = `/admin/contracts/search${params.toString() ? `?${params}` : ""}`;
  const key = ["admin-contracts", search, status];
  const { data, isLoading } = useAdminGet<ListResp>(key, path);

  const actionMutation = useAdminMutation<{ id: number; action: string }>(
    ({ id, action }) => adminApi.post(`/admin/contracts/${id}/${action}`, {}),
    [key],
  );

  const performAction = (id: number, action: string, label: string) => {
    actionMutation.mutate({ id, action }, {
      onSuccess: () => toast({ title: `${label} #${id}` }),
      onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{lang === "ar" ? "العقود" : "Contracts"}</h1>

      <div className="flex flex-wrap gap-2">
        <Input placeholder={lang === "ar" ? "بحث بالعنوان" : "Search title"} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setSearch(q); }} className="max-w-xs" />
        <Button onClick={() => setSearch(q)} variant="outline">{lang === "ar" ? "بحث" : "Search"}</Button>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الحالات" : "All Statuses"}</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="funded">Funded</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="disputed">Disputed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{lang === "ar" ? "العنوان" : "Title"}</TableHead>
              <TableHead>{lang === "ar" ? "العميل" : "Client"}</TableHead>
              <TableHead>{lang === "ar" ? "المستقل" : "Freelancer"}</TableHead>
              <TableHead>{lang === "ar" ? "القيمة" : "Amount"}</TableHead>
              <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
              <TableHead>{lang === "ar" ? "تاريخ" : "Date"}</TableHead>
              <TableHead>{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8}><Skeleton className="h-8" /></TableCell></TableRow>
            ) : !data?.items.length ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{lang === "ar" ? "لا عقود" : "No contracts"}</TableCell></TableRow>
            ) : (
              data.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">#{c.id}</TableCell>
                  <TableCell className="font-medium max-w-xs truncate">{c.title}</TableCell>
                  <TableCell className="text-sm">user#{c.clientId}</TableCell>
                  <TableCell className="text-sm">user#{c.freelancerId}</TableCell>
                  <TableCell>{formatCurrency(c.totalAmount, c.currency, lang)}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{c.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(c.createdAt), "yyyy-MM-dd")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(["hold", "cancel", "mark-disputed"] as const).map((action) => (
                        <AlertDialog key={action}>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant={action === "cancel" ? "destructive" : "outline"}>{action}</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{lang === "ar" ? "تأكيد" : "Confirm"} {action}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {lang === "ar" ? "هل أنت متأكد من تنفيذ هذا الإجراء على العقد" : "Are you sure you want to"} {action} contract #{c.id}?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{lang === "ar" ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => performAction(c.id, action, action)}>
                                {lang === "ar" ? "تأكيد" : "Confirm"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {data && <p className="text-sm text-muted-foreground">{lang === "ar" ? `إجمالي ${data.total}` : `${data.total} contracts`}</p>}
    </div>
  );
}
