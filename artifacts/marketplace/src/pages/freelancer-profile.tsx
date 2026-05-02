import { useRoute } from "wouter";
import { useGetFreelancer, getGetFreelancerQueryKey } from "@workspace/api-client-react";
import { useTranslation, formatCurrency } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Star, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function FreelancerProfile() {
  const [, params] = useRoute("/freelancers/:id");
  const id = parseInt(params?.id || "0", 10);
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  
  const { data: freelancer, isLoading } = useGetFreelancer(id, {
    query: { enabled: !!id, queryKey: getGetFreelancerQueryKey(id) }
  });

  if (isLoading) return <div className="p-8 text-center">{t("common.loading")}</div>;
  if (!freelancer) return <div className="p-8 text-center">{t("common.error")}</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card className="mb-8">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {freelancer.avatarUrl ? (
              <img src={freelancer.avatarUrl} alt={freelancer.fullName} className="w-24 h-24 rounded-full object-cover border-4 border-background shadow-md" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold shadow-md">
                {freelancer.fullName.charAt(0)}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-1">{freelancer.fullName}</h1>
              <p className="text-xl text-muted-foreground mb-3">{freelancer.headline}</p>
              <div className="flex items-center gap-4 text-sm font-medium">
                <div className="flex items-center gap-1 text-yellow-500">
                  <Star className="w-5 h-5 fill-current" />
                  <span>{freelancer.ratingAvg.toFixed(1)}</span>
                  <span className="text-muted-foreground ml-1">({freelancer.ratingCount})</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="w-4 h-4" /> {freelancer.location || "Remote"}
                </div>
                <div className="text-primary font-semibold">
                  {formatCurrency(freelancer.hourlyRate, freelancer.currency, lang)}/hr
                </div>
              </div>
            </div>
            {user?.role === "client" && (
              <Button size="lg" className="w-full sm:w-auto">Message</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <section>
            <h2 className="text-xl font-bold mb-4">About Me</h2>
            <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{freelancer.bio}</div>
          </section>

          {freelancer.portfolio && freelancer.portfolio.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4">Portfolio</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {freelancer.portfolio.map((item, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-1"><a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">{item.title}</a></h3>
                      {item.description && <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-bold mb-4">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {freelancer.skills.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
