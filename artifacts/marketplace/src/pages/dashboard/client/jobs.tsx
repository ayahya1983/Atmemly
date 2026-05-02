import { useListJobs } from "@workspace/api-client-react";
import { useTranslation, formatCurrency } from "@/lib/i18n";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ClientJobs() {
  const { t, lang } = useTranslation();
  const { data: jobs, isLoading } = useListJobs({ mine: true });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "default";
      case "in_progress": return "secondary";
      case "completed": return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">My Jobs</h1>
        <Link href="/dashboard/client/jobs/new">
          <Button className="gap-2"><Plus className="w-4 h-4"/> Post Job</Button>
        </Link>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : jobs?.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <p className="mb-4">You haven't posted any jobs yet.</p>
              <Link href="/dashboard/client/jobs/new">
                <Button variant="outline">Post your first job</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          jobs?.map(job => (
            <Card key={job.id}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getStatusColor(job.status)} className="capitalize">{job.status.replace('_', ' ')}</Badge>
                      <span className="text-sm text-muted-foreground">Posted {formatDistanceToNow(new Date(job.createdAt))} ago</span>
                    </div>
                    <Link href={`/jobs/${job.id}`}>
                      <h3 className="text-lg font-bold hover:text-primary transition-colors mb-1">{job.title}</h3>
                    </Link>
                    <p className="text-sm text-muted-foreground">{job.categoryNameEn}</p>
                  </div>
                  <div className="flex flex-col md:items-end gap-3 shrink-0">
                    <div className="font-semibold text-lg">{formatCurrency(job.budgetMin, job.currency, lang)} - {formatCurrency(job.budgetMax, "", lang)}</div>
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/client/jobs/${job.id}/proposals`}>
                        <Button variant="secondary">View Proposals ({job.proposalCount})</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
