import { useState } from "react";
import { Link } from "wouter";
import { useTranslation, formatCurrency } from "@/lib/i18n";
import { useListFreelancers, useListCategories } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MapPin, Filter, Star } from "lucide-react";

export default function FreelancersDirectory() {
  const { lang, t } = useTranslation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const { data: categories } = useListCategories();
  const { data: freelancers, isLoading } = useListFreelancers({
    q: search || undefined,
    skill: category !== "all" ? category : undefined,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t("nav.freelancers")}</h1>
        <p className="text-muted-foreground">
          {lang === "ar"
            ? "تصفح أفضل المستقلين المعتمدين في الخليج"
            : "Browse vetted freelancers across the GCC"}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-1/4">
          <Card className="sticky top-24">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 font-semibold">
                <Filter className="w-4 h-4" /> {lang === "ar" ? "تصفية" : "Filters"}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{lang === "ar" ? "بحث" : "Search"}</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder={lang === "ar" ? "ابحث..." : "Search..."}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{lang === "ar" ? "الفئة" : "Category"}</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{lang === "ar" ? "الكل" : "All"}</SelectItem>
                    {categories?.map((c) => (
                      <SelectItem key={c.slug} value={c.slug}>
                        {lang === "ar" ? c.nameAr : c.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="flex-1 space-y-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)
          ) : freelancers && freelancers.length > 0 ? (
            freelancers.map((f) => (
              <Card key={f.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex flex-col sm:flex-row gap-6">
                  <Avatar className="w-20 h-20">
                    <AvatarFallback className="text-xl bg-primary/10 text-primary">
                      {f.fullName?.charAt(0) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link href={`/freelancers/${f.id}`}>
                          <h3 className="text-lg font-bold hover:text-primary cursor-pointer">
                            {f.fullName}
                          </h3>
                        </Link>
                        {f.headline && (
                          <p className="text-sm text-muted-foreground">{f.headline}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {typeof f.hourlyRate === "number" && (
                          <p className="font-semibold text-primary">
                            {formatCurrency(f.hourlyRate, "AED", lang)}
                            <span className="text-xs text-muted-foreground">
                              {lang === "ar" ? " /ساعة" : " /hr"}
                            </span>
                          </p>
                        )}
                        {typeof f.ratingAvg === "number" && f.ratingAvg > 0 && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground justify-end">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {f.ratingAvg.toFixed(1)} ({f.ratingCount ?? 0})
                          </div>
                        )}
                      </div>
                    </div>
                    {f.location && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3" /> {f.location}
                      </div>
                    )}
                    {f.skills && f.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {f.skills.slice(0, 6).map((s) => (
                          <Badge key={s} variant="secondary">{s}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex sm:flex-col gap-2 sm:items-end">
                    <Link href={`/freelancers/${f.id}`}>
                      <Button>{lang === "ar" ? "عرض الملف" : "View Profile"}</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                {lang === "ar" ? "لا يوجد مستقلون مطابقون." : "No freelancers found."}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
