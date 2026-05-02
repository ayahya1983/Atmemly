import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, useTranslation } from "@/lib/i18n";

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
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [verification, setVerification] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (verification !== "all") params.set("verificationStatus", verification);
  if (status !== "all") params.set("status", status);
  const path = `/admin/clients${params.toString() ? `?${params}` : ""}`;
  const key = ["admin-clients", search, verification, status];
  const { data, isLoading } = useAdminGet<ListResp>(key, path);

  const verifyMutation = useAdminMutation<{ userId: number; decision: "approved" | "rejected" }>(
    ({ userId, decision }) => adminApi.post(`/admin/clients/${userId}/verify`, { decision }),
    [key],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{lang === "ar" ? "العملاء" : "Clients"}</h1>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder={lang === "ar" ? "بحث" : "Search"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") setSearch(q); }}
          className="max-w-xs"
        />
        <Button onClick={() => setSearch(q)} variant="outline">{lang === "ar" ? "بحث" : "Search"}</Button>
        <Select value={verification} onValueChange={setVerification}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل التحقق" : "All Verification"}</SelectItem>
            <SelectItem value="not_submitted">Not Submitted</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الحالات" : "All Statuses"}</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{lang === "ar" ? "الاسم" : "Name"}</TableHead>
              <TableHead>{lang === "ar" ? "الشركة" : "Company"}</TableHead>
              <TableHead>{lang === "ar" ? "البريد" : "Email"}</TableHead>
              <TableHead>{lang === "ar" ? "الإنفاق" : "Total Spend"}</TableHead>
              <TableHead>{lang === "ar" ? "التحقق" : "Verification"}</TableHead>
              <TableHead>{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}><Skeleton className="h-8" /></TableCell></TableRow>
            ) : !data?.items.length ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{lang === "ar" ? "لا نتائج" : "No results"}</TableCell></TableRow>
            ) : (
              data.items.map((c) => (
                <TableRow key={c.userId}>
                  <TableCell className="font-medium">{c.fullName}</TableCell>
                  <TableCell>{c.companyName ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.email}</TableCell>
                  <TableCell>{formatCurrency(c.totalSpend, "AED", lang)}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{c.verificationStatus.replace("_", " ")}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" disabled={verifyMutation.isPending || c.verificationStatus === "approved"} onClick={() => {
                        verifyMutation.mutate({ userId: c.userId, decision: "approved" }, {
                          onSuccess: () => toast({ title: lang === "ar" ? "تم اعتماد العميل" : "Client approved" }),
                          onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
                        });
                      }}>{lang === "ar" ? "اعتماد" : "Approve"}</Button>
                      <Button size="sm" variant="destructive" disabled={verifyMutation.isPending || c.verificationStatus === "rejected"} onClick={() => {
                        verifyMutation.mutate({ userId: c.userId, decision: "rejected" }, {
                          onSuccess: () => toast({ title: lang === "ar" ? "تم الرفض" : "Rejected" }),
                          onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
                        });
                      }}>{lang === "ar" ? "رفض" : "Reject"}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {data && <p className="text-sm text-muted-foreground">{lang === "ar" ? `إجمالي ${data.total}` : `${data.total} clients total`}</p>}
    </div>
  );
}
