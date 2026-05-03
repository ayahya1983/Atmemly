import { useTranslation, formatPriceDisplay } from "@/lib/i18n";
import {
  useGetMarketplaceStats,
  useListCategories,
  useListFreelancers,
  useListJobs,
} from "@workspace/api-client-react";
import { useBlogPosts, useFaqs, useTestimonials } from "@/lib/api-public";
import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Star,
  MapPin,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Code2,
  PenLine,
  Megaphone,
  Video,
  LineChart,
  Database,
  Headphones,
  CheckCircle2,
  TrendingUp,
  Quote,
  Smartphone,
  Apple,
  Calendar,
  DollarSign,
} from "lucide-react";

// Map category slug → icon component
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  design: PenLine,
  development: Code2,
  writing: PenLine,
  marketing: Megaphone,
  video: Video,
  consulting: LineChart,
  data: Database,
  support: Headphones,
};

export default function Home() {
  const { t, lang, isRtl, currency } = useTranslation();
  const [searchQ, setSearchQ] = useState("");
  const [searchCat, setSearchCat] = useState<string>("all");

  const { data: stats } = useGetMarketplaceStats();
  const { data: categories } = useListCategories();
  const { data: freelancers, isLoading: freelancersLoading } = useListFreelancers({ q: "" });
  const { data: jobs, isLoading: jobsLoading } = useListJobs({});
  const { data: blog } = useBlogPosts(lang);
  const { data: faqs } = useFaqs(lang);
  const { data: testimonials } = useTestimonials(lang);

  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQ) params.set("q", searchQ);
    if (searchCat !== "all") params.set("category", searchCat);
    const qs = params.toString();
    window.location.href = `/freelancers${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex flex-col w-full" data-testid="home-page">
      {/* ── 1. HERO ────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden bg-gradient-to-bl from-primary/5 via-background to-background py-16 md:py-24"
        data-testid="hero-section"
      >
        {/* subtle hex pattern accent */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Text + search (right in RTL, left in LTR) */}
            <div className={`space-y-6 ${isRtl ? "lg:order-2" : ""}`}>
              <p className="text-sm md:text-base text-muted-foreground font-medium">
                {t("hero.eyebrow")}
              </p>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-primary leading-tight">
                {t("hero.title")}
              </h1>
              <p className="text-base md:text-lg text-foreground/80 leading-relaxed max-w-xl">
                {t("hero.body")}
              </p>

              {/* Search bar */}
              <form
                onSubmit={onSearch}
                className="bg-card border shadow-lg rounded-full p-2 flex items-center gap-2 max-w-2xl"
                data-testid="hero-search-form"
              >
                <Select value={searchCat} onValueChange={setSearchCat}>
                  <SelectTrigger
                    className="w-[140px] border-0 shadow-none focus:ring-0 bg-transparent text-foreground font-medium"
                    data-testid="select-search-category"
                  >
                    <SelectValue placeholder={t("hero.tab.services")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("hero.tab.services")}</SelectItem>
                    {categories?.map((c) => (
                      <SelectItem key={c.slug} value={c.slug}>
                        {lang === "ar" ? c.nameAr : c.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="w-px h-6 bg-border" />
                <Input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder={t("hero.search.placeholder")}
                  className="flex-1 border-0 shadow-none focus-visible:ring-0 bg-transparent"
                  data-testid="input-search-query"
                />
                <Button type="submit" size="lg" className="rounded-full gap-2 px-6" data-testid="button-search">
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("hero.search.button")}</span>
                </Button>
              </form>

              {/* tab pills */}
              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  { label: t("hero.tab.services"), href: "/freelancers" },
                  { label: t("hero.tab.projects"), href: "/jobs" },
                  { label: t("hero.tab.works"), href: "/freelancers" },
                  { label: t("hero.tab.freelancers"), href: "/freelancers" },
                ].map((tab) => (
                  <Link key={tab.label} href={tab.href}>
                    <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                      {tab.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Image (left in RTL, right in LTR) */}
            <div className={`relative ${isRtl ? "lg:order-1" : ""}`}>
              <div className="relative aspect-square max-w-md mx-auto">
                <div className="absolute inset-4 rounded-full bg-primary/10 blur-3xl" />
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=600&fit=crop&crop=faces"
                  alt={t("hero.title")}
                  className="relative z-10 w-full h-full object-cover rounded-3xl shadow-2xl"
                  data-testid="hero-image"
                />
                {/* floating badge */}
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-20 bg-card border shadow-lg rounded-full px-5 py-2.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {stats ? `${stats.totalFreelancers}+ ${isRtl ? "مستقل موثوق" : "Verified pros"}` : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* stats strip */}
          {stats && (
            <div className="mt-16 pt-10 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {[
                { value: stats.activeJobs, label: isRtl ? "وظيفة نشطة" : "Active jobs" },
                { value: stats.totalFreelancers, label: isRtl ? "مستقل محترف" : "Pro freelancers" },
                { value: stats.totalClients, label: isRtl ? "شركة وعميل" : "Companies" },
                { value: stats.completedJobs, label: isRtl ? "مشروع مكتمل" : "Projects done" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col">
                  <span className="text-3xl md:text-4xl font-extrabold text-primary">{s.value}+</span>
                  <span className="text-sm text-muted-foreground mt-1">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 2. CATEGORIES ──────────────────────────────────────────── */}
      <section className="py-16 md:py-20 bg-background" data-testid="categories-section">
        <div className="container mx-auto px-4">
          <SectionHeader
            title={t("section.categories.title")}
            subtitle={t("section.categories.subtitle")}
            href="/freelancers"
            t={t}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-5">
            {categories
              ? categories.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.slug] ?? Briefcase;
                  return (
                    <Link key={cat.id} href={`/freelancers?category=${cat.slug}`}>
                      <Card
                        className="hover-elevate cursor-pointer transition-all hover:border-primary hover:shadow-md group h-full"
                        data-testid={`category-card-${cat.slug}`}
                      >
                        <CardContent className="p-5 md:p-6 flex flex-col items-center text-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <Icon className="w-7 h-7" />
                          </div>
                          <h3 className="font-semibold text-sm md:text-base">
                            {lang === "ar" ? cat.nameAr : cat.nameEn}
                          </h3>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })
              : Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        </div>
      </section>

      {/* ── 3. RECOMMENDED SERVICES ────────────────────────────────── */}
      <section className="py-16 md:py-20 bg-secondary/30" data-testid="recommended-services-section">
        <div className="container mx-auto px-4">
          <SectionHeader
            title={t("section.recommended.title")}
            subtitle={t("section.recommended.subtitle")}
            href="/freelancers"
            t={t}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {freelancersLoading
              ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)
              : freelancers?.slice(0, 4).map((f) => (
                  <Link key={`svc-${f.id}`} href={`/freelancers/${f.id}`}>
                    <Card
                      className="hover-elevate cursor-pointer h-full overflow-hidden group"
                      data-testid={`service-card-${f.id}`}
                    >
                      <div className="aspect-[4/3] bg-gradient-to-br from-primary/20 to-primary/5 relative overflow-hidden">
                        <img
                          src={`https://picsum.photos/seed/atmemly-svc-${f.id}/600/450`}
                          alt={f.headline}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      </div>
                      <CardContent className="p-4 space-y-3">
                        <h3 className="font-semibold text-sm leading-snug line-clamp-2 min-h-[2.5rem] group-hover:text-primary transition-colors">
                          {f.headline}
                        </h3>
                        <div className="flex items-center gap-2">
                          {f.avatarUrl ? (
                            <img src={f.avatarUrl} alt={f.fullName} className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                              {f.fullName.charAt(0)}
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground truncate">
                            {t("card.byFreelancer")} <span className="text-foreground font-medium">{f.fullName}</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span className="text-xs font-semibold">{f.ratingAvg.toFixed(1)}</span>
                            <span className="text-xs text-muted-foreground">({f.ratingCount})</span>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-muted-foreground">{t("card.startingFrom")}</div>
                            <div className="text-sm font-bold text-primary">
                              {formatPriceDisplay(f.hourlyRate, f.currency, lang, currency)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* ── 4. BEST FREELANCERS ────────────────────────────────────── */}
      <section className="py-16 md:py-20 bg-background" data-testid="best-freelancers-section">
        <div className="container mx-auto px-4">
          <SectionHeader
            title={t("section.bestFreelancers.title")}
            subtitle={t("section.bestFreelancers.subtitle")}
            href="/freelancers"
            t={t}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {freelancersLoading
              ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)
              : freelancers?.slice(0, 6).map((f) => {
                  const successRate = Math.min(99, 80 + Math.round(f.ratingAvg * 4));
                  return (
                    <Card
                      key={`fr-${f.id}`}
                      className="hover-elevate h-full flex flex-col group"
                      data-testid={`freelancer-card-${f.id}`}
                    >
                      <CardContent className="p-5 flex-1 flex flex-col">
                        <div className="flex items-start gap-3 mb-3">
                          {f.avatarUrl ? (
                            <img src={f.avatarUrl} alt={f.fullName} className="w-14 h-14 rounded-full object-cover border-2 border-background shadow-sm" />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold">
                              {f.fullName.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base group-hover:text-primary transition-colors truncate">{f.fullName}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-1">{f.headline}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              <span className="text-sm font-semibold">{f.ratingAvg.toFixed(1)}</span>
                              <span className="text-xs text-muted-foreground">({f.ratingCount})</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {f.skills.slice(0, 3).map((s) => (
                            <Badge key={s} variant="secondary" className="font-normal text-xs">{s}</Badge>
                          ))}
                          {f.skills.length > 3 && (
                            <Badge variant="secondary" className="font-normal text-xs text-muted-foreground">
                              +{f.skills.length - 3}
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5 text-primary" />
                            <span className="truncate">{f.location || (isRtl ? "عن بُعد" : "Remote")}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <TrendingUp className="w-3.5 h-3.5 text-primary" />
                            <span>{successRate}% {t("card.success")}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-auto pt-3 border-t">
                          <div className="text-sm font-bold text-primary">
                            {formatPriceDisplay(f.hourlyRate, f.currency, lang, currency)}
                            <span className="text-xs text-muted-foreground font-normal">
                              {isRtl ? " /ساعة" : " /hr"}
                            </span>
                          </div>
                          <Link href={`/freelancers/${f.id}`}>
                            <Button size="sm" variant="outline" className="gap-1" data-testid={`button-view-profile-${f.id}`}>
                              {t("card.viewProfile")}
                              <Arrow className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
          </div>
        </div>
      </section>

      {/* ── 5. LATEST PROJECTS ─────────────────────────────────────── */}
      <section className="py-16 md:py-20 bg-secondary/30" data-testid="latest-projects-section">
        <div className="container mx-auto px-4">
          <SectionHeader
            title={t("section.latestProjects.title")}
            subtitle={t("section.latestProjects.subtitle")}
            href="/jobs"
            t={t}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {jobsLoading
              ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)
              : jobs?.slice(0, 6).map((j) => (
                  <Link key={j.id} href={`/jobs/${j.id}`}>
                    <Card
                      className="hover-elevate cursor-pointer h-full group"
                      data-testid={`job-card-${j.id}`}
                    >
                      <CardContent className="p-5 flex flex-col h-full">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h3 className="font-bold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors flex-1">
                            {j.title}
                          </h3>
                          <Badge variant="outline" className="text-xs whitespace-nowrap shrink-0">
                            {j.categorySlug}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                          {j.descriptionShort}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {(j.skills ?? []).slice(0, 4).map((s) => (
                            <Badge key={s} variant="secondary" className="font-normal text-xs">{s}</Badge>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t text-xs">
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(j.createdAt).toLocaleDateString(lang === "ar" ? "ar-AE" : "en-AE")}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5" />
                              {formatPriceDisplay(Number(j.budgetMin ?? 0), j.currency ?? "AED", lang, currency)}
                              {j.budgetMax && j.budgetMax !== j.budgetMin
                                ? ` – ${formatPriceDisplay(Number(j.budgetMax), j.currency ?? "AED", lang, currency)}`
                                : ""}
                            </span>
                          </div>
                          <span className="text-primary font-medium flex items-center gap-1">
                            {t("card.viewProject")}
                            <Arrow className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* ── 6. CTA ─────────────────────────────────────────────────── */}
      <section className="py-16 md:py-20 bg-primary text-primary-foreground" data-testid="cta-section">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("section.cta.title")}</h2>
          <p className="text-base md:text-lg text-primary-foreground/85 mb-8">{t("section.cta.body")}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="text-base h-12 px-8 font-semibold" data-testid="cta-register">
                {t("section.cta.primary")}
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="text-base h-12 px-8 font-semibold bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground hover:text-primary"
                data-testid="cta-login"
              >
                {t("section.cta.secondary")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 7. TESTIMONIALS ────────────────────────────────────────── */}
      {testimonials && testimonials.length > 0 && (
        <section className="py-16 md:py-20 bg-background" data-testid="testimonials-section">
          <div className="container mx-auto px-4">
            <SectionHeader
              title={t("section.testimonials.title")}
              subtitle={t("section.testimonials.subtitle")}
              t={t}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {testimonials.slice(0, 6).map((tst) => (
                <Card key={tst.id} className="h-full" data-testid={`testimonial-card-${tst.id}`}>
                  <CardContent className="p-6 flex flex-col h-full">
                    <Quote className="w-8 h-8 text-primary/30 mb-3" />
                    <p className="text-sm md:text-base leading-relaxed text-foreground/90 mb-5 flex-1">
                      “{tst.body}”
                    </p>
                    <div className="flex items-center gap-3 pt-4 border-t">
                      {tst.avatarUrl ? (
                        <img src={tst.avatarUrl} alt={tst.authorName} className="w-11 h-11 rounded-full object-cover" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {tst.authorName.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{tst.authorName}</div>
                        {tst.authorTitle && (
                          <div className="text-xs text-muted-foreground truncate">{tst.authorTitle}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < tst.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 8. BLOG ────────────────────────────────────────────────── */}
      {blog && blog.length > 0 && (
        <section className="py-16 md:py-20 bg-secondary/30" data-testid="blog-section">
          <div className="container mx-auto px-4">
            <SectionHeader
              title={t("section.blog.title")}
              subtitle={t("section.blog.subtitle")}
              href="/blog"
              t={t}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {blog.slice(0, 3).map((p) => (
                <Card
                  key={p.id}
                  className="hover-elevate cursor-pointer overflow-hidden h-full flex flex-col"
                  data-testid={`blog-card-${p.id}`}
                >
                  <div className="aspect-[16/10] bg-primary/10 relative overflow-hidden">
                    {p.coverUrl ? (
                      <img src={p.coverUrl} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <img
                        src={`https://picsum.photos/seed/atmemly-blog-${p.id}/600/400`}
                        alt={p.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <CardContent className="p-5 flex flex-col flex-1">
                    {p.category && (
                      <Badge variant="secondary" className="self-start mb-2 text-xs">
                        {p.category}
                      </Badge>
                    )}
                    <h3 className="font-bold text-base leading-snug mb-2 line-clamp-2">{p.title}</h3>
                    {p.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">{p.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t mt-auto">
                      <span>
                        {p.publishedAt
                          ? new Date(p.publishedAt).toLocaleDateString(lang === "ar" ? "ar-AE" : "en-AE")
                          : ""}
                      </span>
                      <span className="text-primary font-medium flex items-center gap-1">
                        {t("common.readMore")}
                        <Arrow className="w-3 h-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 9. FAQ ─────────────────────────────────────────────────── */}
      {faqs && faqs.length > 0 && (
        <section className="py-16 md:py-20 bg-background" data-testid="faq-section">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">{t("section.faq.title")}</h2>
              <p className="text-muted-foreground">{t("section.faq.subtitle")}</p>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {faqs.slice(0, 8).map((f) => (
                <AccordionItem key={f.id} value={`faq-${f.id}`} data-testid={`faq-item-${f.id}`}>
                  <AccordionTrigger className="text-start font-semibold hover:no-underline">
                    {f.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {f.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      )}

      {/* ── 10. MOBILE APP ─────────────────────────────────────────── */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground overflow-hidden" data-testid="app-section">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className={`space-y-5 ${isRtl ? "lg:order-2" : ""}`}>
              <h2 className="text-3xl md:text-4xl font-bold">{t("section.app.title")}</h2>
              <p className="text-primary-foreground/85 text-base md:text-lg">{t("section.app.body")}</p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href="#"
                  className="inline-flex items-center gap-3 bg-background/10 hover:bg-background/20 backdrop-blur border border-primary-foreground/20 rounded-xl px-5 py-3 transition-colors"
                  data-testid="link-app-store"
                >
                  <Apple className="w-7 h-7" />
                  <div className="text-start leading-tight">
                    <div className="text-[10px] opacity-75">{isRtl ? "حمّله من" : "Download on the"}</div>
                    <div className="font-semibold">{t("section.app.appStore")}</div>
                  </div>
                </a>
                <a
                  href="#"
                  className="inline-flex items-center gap-3 bg-background/10 hover:bg-background/20 backdrop-blur border border-primary-foreground/20 rounded-xl px-5 py-3 transition-colors"
                  data-testid="link-google-play"
                >
                  <Smartphone className="w-7 h-7" />
                  <div className="text-start leading-tight">
                    <div className="text-[10px] opacity-75">{isRtl ? "حمّله من" : "Get it on"}</div>
                    <div className="font-semibold">{t("section.app.googlePlay")}</div>
                  </div>
                </a>
              </div>
            </div>
            <div className={`relative ${isRtl ? "lg:order-1" : ""}`}>
              <div className="relative max-w-sm mx-auto aspect-[3/4]">
                <div className="absolute inset-6 rounded-3xl bg-primary-foreground/10 blur-2xl" />
                <div className="relative w-full h-full bg-background/95 rounded-[2.5rem] border-8 border-primary-foreground/20 shadow-2xl overflow-hidden flex items-center justify-center">
                  <div className="text-center p-8 text-primary">
                    <CheckCircle2 className="w-20 h-20 mx-auto mb-4" />
                    <div className="text-4xl font-extrabold mb-1">{isRtl ? "أتمملي" : "Atmemly"}</div>
                    <div className="text-xs tracking-[0.3em] text-muted-foreground">
                      {isRtl ? "MOBILE APP" : "تطبيق الجوال"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────
function SectionHeader({
  title,
  subtitle,
  href,
  t,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  t: (k: string) => string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8 md:mb-10">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold mb-1.5">{title}</h2>
        {subtitle && <p className="text-sm md:text-base text-muted-foreground">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href}>
          <span className="hidden sm:inline-flex text-primary hover:underline items-center gap-1.5 font-medium text-sm whitespace-nowrap shrink-0">
            {t("common.viewAll")}
          </span>
        </Link>
      )}
    </div>
  );
}
