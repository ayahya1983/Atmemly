import { useListProposals, useUpdateProposalStatus, getListProposalsQueryKey } from "@workspace/api-client-react";
import { useTranslation, formatCurrency } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function FreelancerProposals() {
  const { lang } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: proposals, isLoading } = useListProposals({ mine: true }, {
    query: { queryKey: getListProposalsQueryKey({ mine: true }) }
  });

  const updateStatus = useUpdateProposalStatus();

  const handleWithdraw = (id: number) => {
    updateStatus.mutate({ id, data: { status: "withdrawn" } }, {
      onSuccess: () => {
        toast({ title: "Proposal withdrawn" });
        queryClient.invalidateQueries({ queryKey: getListProposalsQueryKey({ mine: true }) });
      },
      onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message })
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Proposals</h1>
      {isLoading ? (
        <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32"/>)}</div>
      ) : proposals?.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">You haven't submitted any proposals yet.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {proposals?.map(p => (
            <Card key={p.id}>
              <CardContent className="p-6 flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="capitalize">{p.status}</Badge>
                    <span className="text-sm text-muted-foreground">Submitted {formatDistanceToNow(new Date(p.createdAt))} ago</span>
                  </div>
                  <Link href={`/jobs/${p.jobId}`}>
                    <h3 className="text-lg font-bold hover:text-primary transition-colors mb-1">{p.jobTitle}</h3>
                  </Link>
                  <p className="text-sm text-muted-foreground mt-2">Expected Rate: <span className="font-medium text-foreground">{formatCurrency(p.expectedRate, p.jobCurrency, lang)}</span> | Delivery: <span className="font-medium text-foreground">{p.deliveryDays} days</span></p>
                </div>
                <div className="shrink-0 flex items-center">
                  {(p.status === "pending" || p.status === "shortlisted") && (
                    <Button onClick={() => handleWithdraw(p.id)} variant="outline" className="text-destructive">Withdraw</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
