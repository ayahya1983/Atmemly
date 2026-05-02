import { useTranslation, formatCurrency } from "@/lib/i18n";
import { useGetMarketplaceStats, useListCategories, useListFreelancers } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Users, Star, ArrowRight, ShieldCheck, Zap, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { t, lang, isRtl } = useTranslation();

  const { data: stats } = useGetMarketplaceStats();
  const { data: categories } = useListCategories();
  const { data: freelancers, isLoading: freelancersLoading } = useListFreelancers({ q: "" });

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-primary/5 py-20 md:py-32">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-1/2 h-full bg-accent/5 blur-3xl rounded-full -translate-x-1/2 translate-y-1/4 pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
              {t("hero.title")}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t("hero.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/jobs/new" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto text-base h-14 px-8 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
                  {t("hero.cta")}
                </Button>
              </Link>
              <Link href="/jobs" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base h-14 px-8">
                  {t("hero.secondary_cta")}
                </Button>
              </Link>
            </div>
            
            {stats && (
              <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-center divide-x border-t mt-12">
                <div className="flex flex-col">
                  <span className="text-3xl font-bold text-primary">{stats.activeJobs}+</span>
                  <span className="text-sm text-muted-foreground">Active Jobs</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-3xl font-bold text-primary">{stats.totalFreelancers}+</span>
                  <span className="text-sm text-muted-foreground">Pro Freelancers</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-3xl font-bold text-primary">{stats.totalClients}+</span>
                  <span className="text-sm text-muted-foreground">Companies</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-3xl font-bold text-primary">{stats.completedJobs}+</span>
                  <span className="text-sm text-muted-foreground">Projects Done</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold mb-2">Browse by Category</h2>
              <p className="text-muted-foreground">Find the right expertise for your project</p>
            </div>
            <Link href="/freelancers" className="hidden sm:flex text-primary hover:underline items-center gap-2 font-medium">
              View All {isRtl ? <ArrowRight className="w-4 h-4 rotate-180" /> : <ArrowRight className="w-4 h-4" />}
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {categories ? (
              categories.map((cat) => (
                <Link key={cat.id} href={`/freelancers?category=${cat.slug}`}>
                  <Card className="hover-elevate cursor-pointer transition-colors hover:border-primary/50 group h-full">
                    <CardContent className="p-6 flex flex-col items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Briefcase className="w-6 h-6" />
                      </div>
                      <h3 className="font-semibold text-lg">{lang === "ar" ? cat.nameAr : cat.nameEn}</h3>
                    </CardContent>
                  </Card>
                </Link>
              ))
            ) : (
              Array(8).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))
            )}
          </div>
        </div>
      </section>

      {/* Featured Freelancers */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold mb-2">Top Regional Talent</h2>
              <p className="text-muted-foreground">Work with vetted professionals across the GCC</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {freelancersLoading ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)
            ) : freelancers?.slice(0, 3).map((f) => (
              <Link key={f.id} href={`/freelancers/${f.id}`}>
                <Card className="hover-elevate cursor-pointer h-full flex flex-col group">
                  <CardContent className="p-6 flex-1 flex flex-col">
                    <div className="flex items-start gap-4 mb-4">
                      {f.avatarUrl ? (
                        <img src={f.avatarUrl} alt={f.fullName} className="w-16 h-16 rounded-full object-cover border-2 border-background shadow-sm" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
                          {f.fullName.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{f.fullName}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">{f.headline}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Star className="w-4 h-4 fill-accent text-accent" />
                          <span className="text-sm font-medium">{f.ratingAvg.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">({f.ratingCount} reviews)</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-6 flex-1">
                      {f.skills.slice(0, 3).map(s => (
                        <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>
                      ))}
                      {f.skills.length > 3 && (
                        <Badge variant="secondary" className="font-normal text-muted-foreground">+{f.skills.length - 3}</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t">
                      <div className="font-semibold text-lg">{formatCurrency(f.hourlyRate, f.currency, lang)}/hr</div>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Globe className="w-3 h-3" /> {f.location || "Remote"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-16">How Khidma Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <div className="flex flex-col items-center space-y-4 relative">
              <div className="w-16 h-16 rounded-full bg-primary-foreground/10 flex items-center justify-center mb-2">
                <Briefcase className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold">1. Post a Job</h3>
              <p className="text-primary-foreground/80">Describe your project, budget, and requirements. It takes just minutes.</p>
              <div className="hidden md:block absolute top-8 right-0 translate-x-1/2 w-full h-px bg-primary-foreground/20" style={{ width: 'calc(100% - 4rem)' }} />
            </div>
            <div className="flex flex-col items-center space-y-4 relative">
              <div className="w-16 h-16 rounded-full bg-primary-foreground/10 flex items-center justify-center mb-2">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold">2. Get Proposals</h3>
              <p className="text-primary-foreground/80">Receive competitive bids from verified professionals across the region.</p>
              <div className="hidden md:block absolute top-8 right-0 translate-x-1/2 w-full h-px bg-primary-foreground/20" style={{ width: 'calc(100% - 4rem)' }} />
            </div>
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary-foreground/10 flex items-center justify-center mb-2">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold">3. Hire & Pay Securely</h3>
              <p className="text-primary-foreground/80">Choose the best fit, collaborate through our platform, and pay only when satisfied.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
