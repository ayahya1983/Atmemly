import { useAdminListJobs } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminJobs() {
  const { data: jobs, isLoading } = useAdminListJobs();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Jobs Overview</h1>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Posted</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
            ) : (
              jobs?.map(j => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">{j.title}</TableCell>
                  <TableCell>{j.clientName}</TableCell>
                  <TableCell>{j.categoryNameEn}</TableCell>
                  <TableCell>{formatDistanceToNow(new Date(j.createdAt))} ago</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{j.status.replace("_", " ")}</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
