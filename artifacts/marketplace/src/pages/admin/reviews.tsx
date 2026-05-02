import { useListReviews } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Star } from "lucide-react";

export default function AdminReviews() {
  const { data: reviews, isLoading } = useListReviews({});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reviews</h1>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Comment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
            ) : (
              reviews?.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{formatDistanceToNow(new Date(r.createdAt))} ago</TableCell>
                  <TableCell className="font-medium">{r.fromUserName}</TableCell>
                  <TableCell>{r.jobTitle}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-500 text-yellow-500"/>
                      {r.rating}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{r.comment}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
