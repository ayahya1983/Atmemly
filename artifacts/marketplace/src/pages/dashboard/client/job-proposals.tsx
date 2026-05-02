import { useListProposals, useUpdateProposalStatus, getListProposalsQueryKey, useCreatePaymentIntent, useCompleteJob, useCreateReview } from "@workspace/api-client-react";
import { useTranslation, formatCurrency } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Star } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRoute } from "wouter";

export default function JobProposals() {
  const [, params] = useRoute("/dashboard/client/jobs/:id/proposals");
  const jobId = parseInt(params?.id || "0", 10);
  const { lang } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: proposals, isLoading } = useListProposals({ jobId }, {
    query: { enabled: !!jobId, queryKey: getListProposalsQueryKey({ jobId }) }
  });

  const updateStatus = useUpdateProposalStatus();
  const createPayment = useCreatePaymentIntent();
  const createReview = useCreateReview();
  const completeJob = useCompleteJob();

  const [paymentOpen, setPaymentOpen] = useState<number | null>(null);
  const [reviewOpen, setReviewOpen] = useState<number | null>(null);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const handleStatusChange = (id: number, status: "shortlisted" | "accepted" | "rejected") => {
    updateStatus.mutate({ id, data: { status } }, {
      onSuccess: () => {
        toast({ title: `Proposal marked as ${status}` });
        queryClient.invalidateQueries({ queryKey: getListProposalsQueryKey({ jobId }) });
        if (status === "accepted") {
          setPaymentOpen(id);
        }
      },
      onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message })
    });
  };

  const handlePayment = (proposalId: number, amount: number, currency: string) => {
    createPayment.mutate({ data: { jobId, proposalId, amount, currency } }, {
      onSuccess: () => {
        toast({ title: "Payment Successful", description: "Job has been funded/completed." });
        setPaymentOpen(null);
        completeJob.mutate({ id: jobId });
        setReviewOpen(proposalId);
      },
      onError: (err: any) => toast({ variant: "destructive", title: "Payment Failed", description: err.message })
    });
  };

  const handleReview = (proposalId: number, toUserId: number) => {
    createReview.mutate({ data: { jobId, toUserId, rating: reviewRating, comment: reviewComment } }, {
      onSuccess: () => {
        toast({ title: "Review Submitted" });
        setReviewOpen(null);
        setReviewComment("");
        setReviewRating(5);
      },
      onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message })
    });
  };

  if (isLoading) return <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-48"/>)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Proposals</h1>
      {proposals?.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No proposals yet.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {proposals?.map(p => (
            <Card key={p.id}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {p.freelancerAvatarUrl ? <img src={p.freelancerAvatarUrl} className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">{p.freelancerName[0]}</div>}
                      <div>
                        <h3 className="font-bold">{p.freelancerName}</h3>
                        {p.freelancerRatingAvg !== undefined && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground"><Star className="w-3 h-3 fill-yellow-500 text-yellow-500"/> {p.freelancerRatingAvg.toFixed(1)}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mb-4 line-clamp-3">{p.coverLetter}</div>
                    <div className="flex gap-4 text-sm font-medium">
                      <div>Rate: <span className="text-foreground">{formatCurrency(p.expectedRate, p.jobCurrency || "AED", lang)}</span></div>
                      <div>Delivery: <span className="text-foreground">{p.deliveryDays} days</span></div>
                      <Badge variant="outline" className="capitalize">{p.status}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 md:min-w-[140px]">
                    {p.status === "pending" && (
                      <>
                        <Button onClick={() => handleStatusChange(p.id, "shortlisted")} variant="secondary">Shortlist</Button>
                        <Button onClick={() => handleStatusChange(p.id, "accepted")}>Accept</Button>
                        <Button onClick={() => handleStatusChange(p.id, "rejected")} variant="outline" className="text-destructive">Reject</Button>
                      </>
                    )}
                    {p.status === "shortlisted" && (
                      <>
                        <Button onClick={() => handleStatusChange(p.id, "accepted")}>Accept</Button>
                        <Button onClick={() => handleStatusChange(p.id, "rejected")} variant="outline" className="text-destructive">Reject</Button>
                      </>
                    )}
                    {p.status === "accepted" && (
                      <>
                        <Button variant="outline" className="w-full">Message</Button>
                        <Button onClick={() => setPaymentOpen(p.id)} className="w-full mt-2">Pay Now</Button>
                      </>
                    )}
                  </div>
                </div>

                <Dialog open={paymentOpen === p.id} onOpenChange={(val) => !val && setPaymentOpen(null)}>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Secure Payment</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Card Number</label>
                        <Input placeholder="**** **** **** ****" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-1 block">Expiry</label>
                          <Input placeholder="MM/YY" />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">CVC</label>
                          <Input placeholder="***" type="password" />
                        </div>
                      </div>
                      <Button onClick={() => handlePayment(p.id, p.expectedRate, p.jobCurrency || "AED")} className="w-full mt-4" disabled={createPayment.isPending}>
                        Pay {formatCurrency(p.expectedRate, p.jobCurrency || "AED", lang)}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={reviewOpen === p.id} onOpenChange={(val) => !val && setReviewOpen(null)}>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Leave a Review</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Rating (1-5)</label>
                        <Input type="number" min={1} max={5} value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Comment</label>
                        <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={4} />
                      </div>
                      <Button onClick={() => handleReview(p.id, p.freelancerId)} className="w-full mt-4" disabled={createReview.isPending || !reviewComment.trim()}>
                        Submit Review
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
