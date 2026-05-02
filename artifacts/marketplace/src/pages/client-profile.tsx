import { useRoute } from "wouter";
import { useGetClient, getGetClientQueryKey } from "@workspace/api-client-react";
import { useTranslation } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Star, MapPin } from "lucide-react";

export default function ClientProfile() {
  const [, params] = useRoute("/clients/:id");
  const id = parseInt(params?.id || "0", 10);
  const { t } = useTranslation();
  
  const { data: client, isLoading } = useGetClient(id, {
    query: { enabled: !!id, queryKey: getGetClientQueryKey(id) }
  });

  if (isLoading) return <div className="p-8 text-center">{t("common.loading")}</div>;
  if (!client) return <div className="p-8 text-center">{t("common.error")}</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Card className="mb-8">
        <CardContent className="p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {client.logoUrl || client.avatarUrl ? (
              <img src={client.logoUrl || client.avatarUrl || ''} alt={client.companyName} className="w-24 h-24 rounded-lg object-cover border" />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold">
                {client.companyName.charAt(0)}
              </div>
            )}
            <div className="text-center sm:text-start flex-1">
              <h1 className="text-3xl font-bold mb-1">{client.companyName}</h1>
              <p className="text-muted-foreground mb-3">{client.fullName}</p>
              <div className="flex items-center justify-center sm:justify-start gap-4 text-sm font-medium">
                <div className="flex items-center gap-1 text-yellow-500">
                  <Star className="w-5 h-5 fill-current" />
                  <span>{client.ratingAvg.toFixed(1)}</span>
                  <span className="text-muted-foreground ml-1">({client.ratingCount})</span>
                </div>
                {client.location && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="w-4 h-4" /> {client.location}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">Overview</h2>
        <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{client.overview}</div>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-primary mb-1">{client.activeJobs}</div>
            <div className="text-sm text-muted-foreground">Active Jobs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-primary mb-1">{client.completedJobs}</div>
            <div className="text-sm text-muted-foreground">Completed Jobs</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
