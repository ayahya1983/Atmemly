import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUpdateFreelancerProfile, useGetMe, useGetFreelancer, getGetFreelancerQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";

const profileSchema = z.object({
  fullName: z.string().min(2),
  headline: z.string().optional(),
  bio: z.string().optional(),
  hourlyRate: z.coerce.number().positive(),
  location: z.string().optional(),
});

type PortfolioItem = { title: string; url: string; description: string };

export default function FreelancerProfile() {
  const { toast } = useToast();
  const { data: user } = useGetMe();
  const { data: freelancerData } = useGetFreelancer(user?.id || 0, {
    query: { enabled: !!user?.id, queryKey: getGetFreelancerQueryKey(user?.id || 0) }
  });
  
  const updateProfile = useUpdateFreelancerProfile();

  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "",
      headline: "",
      bio: "",
      hourlyRate: 100,
      location: "",
    },
  });

  useEffect(() => {
    if (freelancerData) {
      form.reset({
        fullName: freelancerData.fullName,
        headline: freelancerData.headline || "",
        bio: freelancerData.bio || "",
        hourlyRate: freelancerData.hourlyRate,
        location: freelancerData.location || "",
      });
      setPortfolio((freelancerData.portfolio as PortfolioItem[]) || []);
    } else if (user) {
      form.reset({
        fullName: user.fullName,
      });
    }
  }, [user, freelancerData, form]);

  const onSubmit = (values: z.infer<typeof profileSchema>) => {
    updateProfile.mutate({ data: { ...values, portfolio } }, {
      onSuccess: () => toast({ title: "Profile updated" }),
      onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message })
    });
  };

  const addPortfolioItem = () => {
    setPortfolio([...portfolio, { title: "", url: "", description: "" }]);
  };

  const removePortfolioItem = (index: number) => {
    setPortfolio(portfolio.filter((_, i) => i !== index));
  };

  const updatePortfolioItem = (index: number, field: keyof PortfolioItem, value: string) => {
    const newPortfolio = [...portfolio];
    newPortfolio[index][field] = value;
    setPortfolio(newPortfolio);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Edit Profile</h1>
      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="fullName" render={({ field }) => (
                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>
              )} />
              <FormField control={form.control} name="headline" render={({ field }) => (
                <FormItem><FormLabel>Headline</FormLabel><FormControl><Input placeholder="e.g. Senior UX Designer" {...field} /></FormControl><FormMessage/></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="hourlyRate" render={({ field }) => (
                  <FormItem><FormLabel>Hourly Rate (AED)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage/></FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="bio" render={({ field }) => (
                <FormItem><FormLabel>Bio</FormLabel><FormControl><Textarea rows={5} {...field} /></FormControl><FormMessage/></FormItem>
              )} />
              
              <div className="pt-6 border-t">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Portfolio Items</h2>
                  <Button type="button" variant="outline" size="sm" onClick={addPortfolioItem}>
                    <Plus className="w-4 h-4 mr-2" /> Add Item
                  </Button>
                </div>
                <div className="space-y-4">
                  {portfolio.map((item, i) => (
                    <div key={i} className="flex gap-4 items-start p-4 border rounded-md relative">
                      <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removePortfolioItem(i)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                      <div className="flex-1 space-y-3">
                        <Input placeholder="Project Title" value={item.title} onChange={e => updatePortfolioItem(i, "title", e.target.value)} />
                        <Input placeholder="URL (e.g. https://github.com/...)" value={item.url} onChange={e => updatePortfolioItem(i, "url", e.target.value)} />
                        <Textarea placeholder="Short description" rows={2} value={item.description} onChange={e => updatePortfolioItem(i, "description", e.target.value)} />
                      </div>
                    </div>
                  ))}
                  {portfolio.length === 0 && (
                    <div className="text-center p-4 text-sm text-muted-foreground border rounded-md border-dashed">
                      No portfolio items added yet.
                    </div>
                  )}
                </div>
              </div>

              <Button type="submit" disabled={updateProfile.isPending}>Save Changes</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
