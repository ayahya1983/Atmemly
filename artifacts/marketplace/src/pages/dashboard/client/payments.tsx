import { useListPayments } from "@workspace/api-client-react";
import { useTranslation, formatCurrency } from "@/lib/i18n";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

export default function ClientPayments() {
  const { lang } = useTranslation();
  const { data: payments, isLoading } = useListPayments();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Payments</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Freelancer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : payments?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">No payments found</TableCell></TableRow>
              ) : (
                payments?.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDistanceToNow(new Date(p.createdAt))} ago</TableCell>
                    <TableCell className="font-medium">{p.jobTitle}</TableCell>
                    <TableCell>{p.payeeName}</TableCell>
                    <TableCell>{formatCurrency(p.amount, p.currency, lang)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{p.status}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
