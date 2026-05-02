import { useListSavedJobs, useUnsaveJob, getListSavedJobsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookmarkMinus } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export default function FreelancerSavedJobs() {
  const queryClient = useQueryClient();
  const { data: savedJobs, isLoading } = useListSavedJobs({
    query: { queryKey: getListSavedJobsQueryKey() }
  });
  const unsaveJob = useUnsaveJob();

  const handleUnsave = (jobId: number) => {
    unsaveJob.mutate({ jobId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSavedJobsQueryKey() })
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Saved Jobs</h1>
      {isLoading ? (
        <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32"/>)}</div>
      ) : savedJobs?.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">You have no saved jobs.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {savedJobs?.map(job => (
            <Card key={job.id}>
              <CardContent className="p-6 flex justify-between items-center gap-4">
                <div>
                  <Link href={`/jobs/${job.id}`}>
                    <h3 className="text-lg font-bold hover:text-primary transition-colors">{job.title}</h3>
                  </Link>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleUnsave(job.id)}>
                  <BookmarkMinus className="w-5 h-5 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
