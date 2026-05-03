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
import { useCmsPageWithFallback } from "@/lib/api-public";
import { SeoHead } from "@/components/SeoHead";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";

const contactSchema = z.object({
  subject: z.string().min(3),
  body: z.string().min(10),
});

export default function Contact() {
  const { t, lang } = useTranslation();
  const { toast } = useToast();
  const createComplaint = useCreateComplaint();
  const { data: cmsPage, isLoading: cmsLoading, isError: cmsError, isNotFound: cmsNotFound } = useCmsPageWithFallback("contact", lang);
  const isDev = import.meta.env.DEV;

  const form = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { subject: "", body: "" },
  });

  // In production, treat a missing CMS "contact" page as a 404. In dev we
  // keep the form rendered (with the hardcoded fallback title) so the page
  // is still useful before the CMS entry is seeded.
  if (cmsNotFound && !isDev) {
    return <NotFound />;
  }

  const onSubmit = (values: z.infer<typeof contactSchema>) => {
    createComplaint.mutate({ data: values }, {
      onSuccess: () => {
        toast({
          title: (lang === "ar" ? "تم إرسال الرسالة" : "Message sent"),
          description: (lang === "ar" ? "سنرد عليك قريبًا." : "We will get back to you shortly."),
        });
        form.reset();
      },
      onError: (err: any) =>
        toast({
          variant: "destructive",
          title: (lang === "ar" ? "خطأ" : "Error"),
          description: err.message,
        }),
    });
  };

  const fallbackTitle = lang === "ar" ? "اتصل بنا" : "Contact Us";
  const title = cmsPage?.title ?? fallbackTitle;

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <SeoHead
        title={cmsPage?.seoTitle || title}
        description={cmsPage?.seoDescription ?? undefined}
      />
      {cmsLoading ? (
        <Skeleton className="h-10 w-1/3 mb-6" />
      ) : (
        <h1 className="text-4xl font-bold mb-6" data-testid="contact-page-title">{title}</h1>
      )}
      {cmsPage?.body && !cmsError && (
        <div
          className="prose prose-slate max-w-none text-muted-foreground mb-8"
          data-testid="contact-page-body"
          dangerouslySetInnerHTML={{ __html: cmsPage.body }}
        />
      )}
      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem>
                  <FormLabel>{(lang === "ar" ? "الموضوع" : "Subject")}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="body" render={({ field }) => (
                <FormItem>
                  <FormLabel>{(lang === "ar" ? "الرسالة" : "Message")}</FormLabel>
                  <FormControl><Textarea rows={6} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={createComplaint.isPending} data-testid="contact-submit">
                {(lang === "ar" ? "إرسال الرسالة" : "Send Message")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
