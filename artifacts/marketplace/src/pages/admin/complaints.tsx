import { useAdminListComplaints } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminComplaints() {
  const { data: complaints, isLoading } = useAdminListComplaints();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Complaints</h1>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
            ) : (
              complaints?.map(c => (
                <TableRow key={c.id}>
                  <TableCell>{formatDistanceToNow(new Date(c.createdAt))} ago</TableCell>
                  <TableCell className="font-medium">{c.fromUserName}</TableCell>
                  <TableCell>{c.subject}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{c.status}</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
