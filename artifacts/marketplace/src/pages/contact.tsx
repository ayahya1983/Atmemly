import { useTranslation } from "@/lib/i18n";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateComplaint } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

const contactSchema = z.object({
  subject: z.string().min(3),
  body: z.string().min(10),
});

export default function Contact() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const createComplaint = useCreateComplaint();

  const form = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { subject: "", body: "" },
  });

  const onSubmit = (values: z.infer<typeof contactSchema>) => {
    createComplaint.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Message sent", description: "We will get back to you shortly." });
        form.reset();
      },
      onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message })
    });
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <h1 className="text-4xl font-bold mb-8">Contact Us</h1>
      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem><FormLabel>Subject</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>
              )} />
              <FormField control={form.control} name="body" render={({ field }) => (
                <FormItem><FormLabel>Message</FormLabel><FormControl><Textarea rows={6} {...field} /></FormControl><FormMessage/></FormItem>
              )} />
              <Button type="submit" disabled={createComplaint.isPending}>Send Message</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
