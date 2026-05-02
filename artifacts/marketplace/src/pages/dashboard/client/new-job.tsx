import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateJob, useListCategories, useListSkills } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

const jobSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  categorySlug: z.string().min(1, "Please select a category"),
  budgetType: z.enum(["fixed", "hourly"]),
  budgetMin: z.coerce.number().positive(),
  budgetMax: z.coerce.number().positive(),
  currency: z.string().default("AED"),
  skills: z.array(z.string()).min(1, "Select at least one skill"),
});

export default function NewJob() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createJob = useCreateJob();
  const { data: categories } = useListCategories();
  const { data: allSkills } = useListSkills();

  const form = useForm<z.infer<typeof jobSchema>>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: "",
      description: "",
      categorySlug: "",
      budgetType: "fixed",
      budgetMin: 0,
      budgetMax: 0,
      currency: "AED",
      skills: [],
    },
  });

  const onSubmit = (values: z.infer<typeof jobSchema>) => {
    createJob.mutate({ data: values as any }, {
      onSuccess: (job) => {
        toast({ title: "Job posted successfully!" });
        setLocation(`/jobs/${job.id}`);
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error posting job", description: err.message });
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Post a New Job</h1>
      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Job Title</FormLabel><FormControl><Input placeholder="E.g., Senior React Developer needed" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="categorySlug" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {categories?.map(c => <SelectItem key={c.slug} value={c.slug}>{c.nameEn}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={6} placeholder="Describe the project..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="budgetType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="budgetMin" render={({ field }) => (
                  <FormItem><FormLabel>Min Budget (AED)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="budgetMax" render={({ field }) => (
                  <FormItem><FormLabel>Max Budget (AED)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="skills" render={() => (
                <FormItem>
                  <div className="mb-4"><FormLabel>Skills Required</FormLabel></div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {allSkills?.map((skill) => (
                      <FormField key={skill.id} control={form.control} name="skills" render={({ field }) => {
                        return (
                          <FormItem key={skill.id} className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(skill.name)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, skill.name])
                                    : field.onChange(field.value?.filter((value) => value !== skill.name))
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">{skill.name}</FormLabel>
                          </FormItem>
                        )
                      }} />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full" disabled={createJob.isPending}>Post Job</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
