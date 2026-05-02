import { useAdminListPayments } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, useTranslation } from "@/lib/i18n";

export default function AdminPayments() {
  const { data: payments, isLoading } = useAdminListPayments();
  const { lang } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Payments Record</h1>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Payer</TableHead>
              <TableHead>Payee</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
            ) : (
              payments?.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{formatDistanceToNow(new Date(p.createdAt))} ago</TableCell>
                  <TableCell className="font-medium">{p.jobTitle}</TableCell>
                  <TableCell>{p.payerName}</TableCell>
                  <TableCell>{p.payeeName}</TableCell>
                  <TableCell>{formatCurrency(p.amount, p.currency, lang)}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{p.status}</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
