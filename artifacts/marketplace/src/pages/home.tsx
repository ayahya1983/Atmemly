import { useTranslation, formatPriceDisplay } from "@/lib/i18n";
import {
  useGetMarketplaceStats,
  useListCategories,
  useListFreelancers,
  useListJobs,
} from "@workspace/api-client-react";
import { useBlogPosts, useFaqs, useTestimonials, useCmsHomepage, safeHref } from "@/lib/api-public";
import { BRAND } from "@workspace/branding";
import { Link } from "wouter";
import React, { useState } from "react";
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
  Camera,
  Scale,
  Languages,
  CheckCircle2,
  TrendingUp,
  Quote,
  Smartphone,
  Apple,
  Calendar,
  DollarSign,
} from "lucide-react";

// Treat null, undefined, and empty/whitespace strings as "no image".
function hasImage(url: string | null | undefined): url is string {
  return typeof url === "string" && url.trim() !== "";
}

// Image that swaps to a fallback (or hides itself) on load failure, so the
// user never sees a broken-image icon. Pass `fallback` to render an explicit
// substitute (e.g. an initial-letter avatar); omit it to let the parent's
// existing background placeholder show through.
function SafeImg({
  fallback,
  onError,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { fallback?: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback ?? null}</>;
  return (
    <img
      {...props}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
    />
  );
}

// Stable cover-image picker: same freelancer always gets the same cover,
// regardless of position in the list.
function coverForFreelancer(id: number): string {
  const n = (Math.abs(id) % 6) + 1;
  return `${import.meta.env.BASE_URL}assets/services/service-0${n}.svg`;
}

// Map category slug → icon component
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  design: PenLine,
  development: Code2,
  writing: PenLine,
  translation: Languages,
  marketing: Megaphone,
  video: Video,
  photography: Camera,
  consulting: LineChart,
  "legal-finance": Scale,
  data: Database,
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
  const { data: homepageCms } = useCmsHomepage();

  const cmsHero = homepageCms?.hero;
  const heroTitle = (cmsHero && (lang === "ar" ? cmsHero.titleAr : cmsHero.titleEn)) || t("hero.title");
  const heroBody = (cmsHero && (lang === "ar" ? cmsHero.subtitleAr : cmsHero.subtitleEn)) || t("hero.body");
  const heroSearchPlaceholder = (cmsHero && (lang === "ar" ? cmsHero.searchPlaceholderAr : cmsHero.searchPlaceholderEn)) || t("hero.search.placeholder");
  const heroImage = cmsHero?.imageUrl || `${import.meta.env.BASE_URL}assets/hero/gcc-talent-hero.png`;
  const sectionMap = new Map((homepageCms?.sections ?? []).map((s) => [s.key, s]));
  const sectionVisible = (key: string): boolean => {
    const sec = sectionMap.get(key);
    return sec ? sec.isVisible : true;
  };
  const sectionTitle = (key: string, fallback: string): string => {
    const sec = sectionMap.get(key);
    if (!sec) return fallback;
    return (lang === "ar" ? sec.titleAr : sec.titleEn) || fallback;
  };
  const sectionSubtitle = (key: string, fallback: string): string => {
    const sec = sectionMap.get(key);
    if (!sec) return fallback;
    return (lang === "ar" ? sec.subtitleAr : sec.subtitleEn) || fallback;
  };
  const ctaPrimaryLabel = (cmsHero && (lang === "ar" ? cmsHero.ctaPrimaryLabelAr : cmsHero.ctaPrimaryLabelEn)) || t("section.cta.primary");
  const ctaSecondaryLabel = (cmsHero && (lang === "ar" ? cmsHero.ctaSecondaryLabelAr : cmsHero.ctaSecondaryLabelEn)) || t("section.cta.secondary");
  const ctaPrimaryHref = safeHref(cmsHero?.ctaPrimaryHref, "/register");
  const ctaSecondaryHref = safeHref(cmsHero?.ctaSecondaryHref, "/login");

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
                {heroTitle}
              </h1>
              <p className="text-base md:text-lg text-foreground/80 leading-relaxed max-w-xl">
                {heroBody}
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
                  placeholder={heroSearchPlaceholder}
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
                  src={heroImage}
                  alt={isRtl ? "أتمملي — منصة المستقلين العرب في الإمارات والخليج" : "ATMEMLY — UAE & GCC freelance marketplace"}
                  width={600}
                  height={600}
                  fetchPriority="high"
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

      {/* CMS-driven sections — rendered below in CMS sortOrder. */}
      {(() => {
        const sectionDefs = (homepageCms?.sections ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
        const knownKeys = new Set(sectionDefs.map((s) => s.key));
        const sectionNodes: Record<string, React.ReactNode> = {
          categories: (
      <>{sectionVisible("categories") && (
      <section className="py-16 md:py-20 bg-background" data-testid="categories-section">
        <div className="container mx-auto px-4">
          <SectionHeader
            title={sectionTitle("categories", t("section.categories.title"))}
            subtitle={sectionSubtitle("categories", t("section.categories.subtitle"))}
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
      </section>)}</>
          ),
          featured_services: (
      <>{sectionVisible("featured_services") && (
      <section className="py-16 md:py-20 bg-secondary/30" data-testid="recommended-services-section">
        <div className="container mx-auto px-4">
          <SectionHeader
            title={sectionTitle("featured_services", t("section.recommended.title"))}
            subtitle={sectionSubtitle("featured_services", t("section.recommended.subtitle"))}
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
                        <SafeImg
                          src={coverForFreelancer(f.id)}
                          alt={f.headline}
                          width={600}
                          height={450}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      </div>
                      <CardContent className="p-4 space-y-3">
                        <h3 className="font-semibold text-sm leading-snug line-clamp-2 min-h-[2.5rem] group-hover:text-primary transition-colors">
                          {f.headline}
                        </h3>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const initials = (
                              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                {f.fullName.charAt(0)}
                              </div>
                            );
                            return hasImage(f.avatarUrl) ? (
                              <SafeImg
                                src={f.avatarUrl}
                                alt={f.fullName}
                                loading="lazy"
                                width={28}
                                height={28}
                                className="w-7 h-7 rounded-full object-cover"
                                fallback={initials}
                              />
                            ) : (
                              initials
                            );
                          })()}
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
      </section>)}</>
          ),
          featured_freelancers: (
      <>{sectionVisible("featured_freelancers") && (
      <section className="py-16 md:py-20 bg-background" data-testid="best-freelancers-section">
        <div className="container mx-auto px-4">
          <SectionHeader
            title={sectionTitle("featured_freelancers", t("section.bestFreelancers.title"))}
            subtitle={sectionSubtitle("featured_freelancers", t("section.bestFreelancers.subtitle"))}
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
                          {(() => {
                            const initials = (
                              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold">
                                {f.fullName.charAt(0)}
                              </div>
                            );
                            return hasImage(f.avatarUrl) ? (
                              <SafeImg
                                src={f.avatarUrl}
                                alt={f.fullName}
                                loading="lazy"
                                width={56}
                                height={56}
                                className="w-14 h-14 rounded-full object-cover border-2 border-background shadow-sm"
                                fallback={initials}
                              />
                            ) : (
                              initials
                            );
                          })()}
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
      </section>)}</>
          ),
          featured_jobs: (
      <>{sectionVisible("featured_jobs") && (
      <section className="py-16 md:py-20 bg-secondary/30" data-testid="latest-projects-section">
        <div className="container mx-auto px-4">
          <SectionHeader
            title={sectionTitle("featured_jobs", t("section.latestProjects.title"))}
            subtitle={sectionSubtitle("featured_jobs", t("section.latestProjects.subtitle"))}
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
      </section>)}</>
          ),
          cta: (
      <>{sectionVisible("cta") && (
      <section className="py-16 md:py-20 bg-primary text-primary-foreground" data-testid="cta-section">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{sectionTitle("cta", t("section.cta.title"))}</h2>
          <p className="text-base md:text-lg text-primary-foreground/85 mb-8">{sectionSubtitle("cta", t("section.cta.body"))}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={ctaPrimaryHref}>
              <Button size="lg" variant="secondary" className="text-base h-12 px-8 font-semibold" data-testid="cta-register">
                {ctaPrimaryLabel}
              </Button>
            </Link>
            <Link href={ctaSecondaryHref}>
              <Button
                size="lg"
                variant="outline"
                className="text-base h-12 px-8 font-semibold bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground hover:text-primary"
                data-testid="cta-login"
              >
                {ctaSecondaryLabel}
              </Button>
            </Link>
          </div>
        </div>
      </section>)}</>
          ),
          testimonials: (
      <>{sectionVisible("testimonials") && testimonials && testimonials.length > 0 && (
        <section className="py-16 md:py-20 bg-background" data-testid="testimonials-section">
          <div className="container mx-auto px-4">
            <SectionHeader
              title={sectionTitle("testimonials", t("section.testimonials.title"))}
              subtitle={sectionSubtitle("testimonials", t("section.testimonials.subtitle"))}
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
                      {(() => {
                        const initials = (
                          <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                            {tst.authorName.charAt(0)}
                          </div>
                        );
                        return hasImage(tst.avatarUrl) ? (
                          <SafeImg
                            src={tst.avatarUrl}
                            alt={tst.authorName}
                            loading="lazy"
                            width={44}
                            height={44}
                            className="w-11 h-11 rounded-full object-cover"
                            fallback={initials}
                          />
                        ) : (
                          initials
                        );
                      })()}
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
      )}</>
          ),
          blog: (
      <>{sectionVisible("blog") && blog && blog.length > 0 && (
        <section className="py-16 md:py-20 bg-secondary/30" data-testid="blog-section">
          <div className="container mx-auto px-4">
            <SectionHeader
              title={sectionTitle("blog", t("section.blog.title"))}
              subtitle={sectionSubtitle("blog", t("section.blog.subtitle"))}
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
                    <SafeImg
                      src={hasImage(p.coverUrl) ? p.coverUrl : `${import.meta.env.BASE_URL}assets/blog/blog-0${((p.id - 1) % 3) + 1}.svg`}
                      alt={p.title}
                      width={800}
                      height={500}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
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
      )}</>
          ),
          faq: (
      <>{sectionVisible("faq") && faqs && faqs.length > 0 && (
        <section className="py-16 md:py-20 bg-background" data-testid="faq-section">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">{sectionTitle("faq", t("section.faq.title"))}</h2>
              <p className="text-muted-foreground">{sectionSubtitle("faq", t("section.faq.subtitle"))}</p>
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
      )}</>
          ),
          mobile_app: (
      <>{sectionVisible("mobile_app") && (
      <section className="py-16 md:py-20 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground overflow-hidden" data-testid="app-section">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className={`space-y-5 ${isRtl ? "lg:order-2" : ""}`}>
              <h2 className="text-3xl md:text-4xl font-bold">{sectionTitle("mobile_app", t("section.app.title"))}</h2>
              <p className="text-primary-foreground/85 text-base md:text-lg">{sectionSubtitle("mobile_app", t("section.app.body"))}</p>
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
                <img
                  src={`${import.meta.env.BASE_URL}assets/mobile/gcc-mobile-app.png`}
                  alt={isRtl ? `تطبيق ${BRAND.nameAr} للجوال` : `${BRAND.name} mobile app`}
                  width={600}
                  height={800}
                  loading="lazy"
                  className="relative w-full h-full object-cover rounded-[2.5rem] border-8 border-primary-foreground/20 shadow-2xl"
                  data-testid="app-image"
                />
              </div>
            </div>
          </div>
        </div>
      </section>)}</>
          ),
          how_it_works: (
      <>{sectionVisible("how_it_works") && (
        <section className="py-16 md:py-20 bg-background" data-testid="how-it-works-section">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                {sectionTitle("how_it_works", isRtl ? "كيف يعمل أتمملي" : "How ATMEMLY works")}
              </h2>
              <p className="text-muted-foreground">
                {sectionSubtitle("how_it_works", isRtl ? "ثلاث خطوات بسيطة للبدء" : "Three simple steps to get started")}
              </p>
            </div>
          </div>
        </section>
      )}</>
          ),
          footer_cta: (
      <>{sectionVisible("footer_cta") && (
        <section className="py-12 md:py-16 bg-secondary/40 border-t" data-testid="footer-cta-section">
          <div className="container mx-auto px-4 text-center max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              {sectionTitle("footer_cta", isRtl ? "هل أنت جاهز للبدء؟" : "Ready to get started?")}
            </h2>
            <p className="text-muted-foreground mb-6">
              {sectionSubtitle("footer_cta", isRtl ? "انضم إلى آلاف العملاء والمستقلين على أتمملي اليوم." : "Join thousands of clients and freelancers on ATMEMLY today.")}
            </p>
          </div>
        </section>
      )}</>
          ),
        };
        // Render keys in CMS-defined order, then any remaining default keys.
        const orderedKeys = sectionDefs.map((s) => s.key);
        const remainingKeys = Object.keys(sectionNodes).filter((k) => !knownKeys.has(k));
        return [...orderedKeys, ...remainingKeys]
          .filter((k) => k in sectionNodes)
          .map((k) => <React.Fragment key={k}>{sectionNodes[k]}</React.Fragment>);
      })()}
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
