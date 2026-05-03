import { useState } from "react";
import { useTranslation, formatCurrency } from "@/lib/i18n";
import { useListJobs, useListCategories } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Clock, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function JobsDirectory() {
  const { t, lang } = useTranslation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const { data: categories } = useListCategories();

  const { data: jobs, isLoading } = useListJobs({
    q: search || undefined,
    category: category !== "all" ? category : undefined,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("jobs.title")}</h1>
          <p className="text-muted-foreground">{t("jobs.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-1/4 space-y-6">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="w-5 h-5" /> {t("jobs.filters.heading")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("jobs.filters.searchLabel")}</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("jobs.filters.searchPlaceholder")}
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("jobs.filters.categoryLabel")}</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("jobs.filters.allCategories")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("jobs.filters.allCategories")}</SelectItem>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.slug} value={cat.slug}>
                        {lang === "ar" ? cat.nameAr : cat.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full lg:w-3/4 space-y-4">
          {isLoading ? (
            Array(5).fill(0).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 h-40 bg-muted/20" />
              </Card>
            ))
          ) : jobs?.length === 0 ? (
            <div className="text-center py-12 bg-muted/10 rounded-xl border border-dashed">
              <h3 className="text-lg font-medium mb-2">{t("jobs.empty.title")}</h3>
              <p className="text-muted-foreground mb-4">{t("jobs.empty.body")}</p>
              <Button variant="outline" onClick={() => { setSearch(""); setCategory("all"); }}>
                {t("jobs.empty.clear")}
              </Button>
            </div>
          ) : (
            jobs?.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-primary font-medium">
                            {lang === "ar" ? job.categoryNameAr || job.categoryNameEn : job.categoryNameEn}
                          </span>
                          <span className="text-muted-foreground text-sm">•</span>
                          <span className="text-muted-foreground text-sm flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                          {job.title}
                        </h3>
                        {job.descriptionShort && (
                          <p className="text-muted-foreground mb-4 line-clamp-2">
                            {job.descriptionShort}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {job.skills.map((skill) => (
                            <Badge key={skill} variant="secondary" className="font-normal">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-start md:items-end gap-2 shrink-0 md:min-w-[150px]">
                        <div className="text-lg font-bold">
                          {formatCurrency(job.budgetMin, job.currency, lang)}
                          {job.budgetMax > job.budgetMin && ` - ${formatCurrency(job.budgetMax, "", lang)}`}
                        </div>
                        <div className="text-sm text-muted-foreground capitalize">
                          {job.budgetType} {t("jobs.budget.suffix")}
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">
                          <span className="font-medium text-foreground">{job.proposalCount}</span> {t("jobs.proposals")}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
