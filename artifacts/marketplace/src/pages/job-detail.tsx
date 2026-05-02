import { useRoute } from "wouter";
import { useGetJob, useCreateProposal, useSaveJob, useUnsaveJob, getGetJobQueryKey } from "@workspace/api-client-react";
import { useTranslation, formatCurrency } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Clock, MapPin, Bookmark, BookmarkCheck, Briefcase } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const proposalSchema = z.object({
  coverLetter: z.string().min(20, "Cover letter must be at least 20 characters"),
  expectedRate: z.coerce.number().positive("Expected rate must be positive"),
  deliveryDays: z.coerce.number().int().positive("Delivery days must be positive"),
});

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const jobId = parseInt(params?.id || "0", 10);
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: job, isLoading } = useGetJob(jobId, {
    query: { enabled: !!jobId, queryKey: getGetJobQueryKey(jobId) }
  });

  const saveJob = useSaveJob();
  const unsaveJob = useUnsaveJob();
  const createProposal = useCreateProposal();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof proposalSchema>>({
    resolver: zodResolver(proposalSchema),
    defaultValues: { coverLetter: "", expectedRate: 0, deliveryDays: 1 }
  });

  const onSubmit = (values: z.infer<typeof proposalSchema>) => {
    createProposal.mutate({ data: { ...values, jobId } }, {
      onSuccess: () => {
        toast({ title: "Proposal submitted successfully!" });
        setOpen(false);
        queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
      },
      onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message })
    });
  };

  const toggleSave = () => {
    if (job?.saved) {
      unsaveJob.mutate({ jobId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) })
      });
    } else {
      saveJob.mutate({ jobId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) })
      });
    }
  };

  if (isLoading) return <div className="p-8 text-center">{t("common.loading")}</div>;
  if (!job) return <div className="p-8 text-center">{t("common.error")}</div>;

  const isFreelancer = user?.role === "freelancer";

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{job.title}</h1>
          <div className="flex items-center gap-4 text-muted-foreground text-sm">
            <span className="flex items-center gap-1"><Clock className="w-4 h-4"/> {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
            <span className="flex items-center gap-1"><Briefcase className="w-4 h-4"/> {lang === "ar" ? job.categoryNameAr || job.categoryNameEn : job.categoryNameEn}</span>
          </div>
        </div>
        {isFreelancer && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={toggleSave}>
              {job.saved ? <BookmarkCheck className="w-5 h-5 text-primary" /> : <Bookmark className="w-5 h-5" />}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Apply Now</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Submit Proposal</DialogTitle></DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="expectedRate" render={({ field }) => (
                      <FormItem><FormLabel>Expected Rate ({job.currency})</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage/></FormItem>
                    )} />
                    <FormField control={form.control} name="deliveryDays" render={({ field }) => (
                      <FormItem><FormLabel>Delivery Days</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage/></FormItem>
                    )} />
                    <FormField control={form.control} name="coverLetter" render={({ field }) => (
                      <FormItem><FormLabel>Cover Letter</FormLabel><FormControl><Textarea rows={5} {...field} /></FormControl><FormMessage/></FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={createProposal.isPending}>Submit</Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">Job Description</h2>
            <div className="whitespace-pre-wrap text-muted-foreground">{job.description}</div>
          </section>
          <section>
            <h2 className="text-xl font-semibold mb-4">Skills Required</h2>
            <div className="flex flex-wrap gap-2">
              {job.skills.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Job Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Budget</p>
                <p className="font-semibold">{formatCurrency(job.budgetMin, job.currency, lang)} - {formatCurrency(job.budgetMax, "", lang)} ({job.budgetType})</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Proposals</p>
                <p className="font-semibold">{job.proposalCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">About the Client</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                {job.clientLogoUrl ? <img src={job.clientLogoUrl} className="w-12 h-12 rounded bg-muted object-cover"/> : <div className="w-12 h-12 rounded bg-muted flex items-center justify-center font-bold text-lg text-muted-foreground">{job.clientName[0]}</div>}
                <div>
                  <p className="font-medium">{job.clientCompany || job.clientName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
