import { Link, useSearch } from "wouter";
import { useTranslation } from "@/lib/i18n";
import { useBlogPosts, useBlogCategories } from "@/lib/api-public";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale } from "date-fns/locale";

export default function Blog() {
  const { lang, t } = useTranslation();
  const search = useSearch();
  const categoryFilter = new URLSearchParams(search).get("category");
  const { data: posts, isLoading } = useBlogPosts(lang);
  const { data: categories } = useBlogCategories();
  const activeCat = categoryFilter ? categories?.find((c) => c.slug === categoryFilter) : undefined;
  const visiblePosts = activeCat
    ? (posts ?? []).filter((p) => p.category === activeCat.slug || p.categoryId === activeCat.id)
    : (posts ?? []);
  const seoTitle = activeCat ? (lang === "ar" ? activeCat.seoTitleAr : activeCat.seoTitleEn) : undefined;
  const seoDescription = activeCat ? (lang === "ar" ? activeCat.seoDescriptionAr : activeCat.seoDescriptionEn) : undefined;

  return (
    <div className="container mx-auto px-4 py-12">
      <SeoHead
        title={seoTitle ?? (activeCat ? (lang === "ar" ? activeCat.nameAr : activeCat.nameEn) : undefined)}
        description={seoDescription ?? undefined}
        image={activeCat?.seoImageUrl ?? undefined}
      />
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-3" data-testid="blog-page-title">
          {activeCat ? (lang === "ar" ? activeCat.nameAr : activeCat.nameEn) : t("page.blog.title")}
        </h1>
        <p className="text-muted-foreground">{t("page.blog.subtitle")}</p>
        {(categories?.length ?? 0) > 0 && (
          <div className="flex gap-2 mt-4 flex-wrap" data-testid="blog-categories-filter">
            <Link href="/blog">
              <Badge variant={!activeCat ? "default" : "outline"} className="cursor-pointer">
                {lang === "ar" ? "الكل" : "All"}
              </Badge>
            </Link>
            {categories!.filter((c) => c.isActive).map((c) => (
              <Link key={c.id} href={`/blog?category=${c.slug}`}>
                <Badge variant={activeCat?.id === c.id ? "default" : "outline"} className="cursor-pointer">
                  {lang === "ar" ? c.nameAr : c.nameEn}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : !visiblePosts || visiblePosts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            {lang === "ar" ? "لا توجد مقالات منشورة بعد." : "No blog posts published yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visiblePosts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`}>
              <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
                {post.coverUrl ? (
                  <div className="aspect-video bg-muted overflow-hidden">
                    <img
                      src={post.coverUrl}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/5" />
                )}
                <CardContent className="p-5">
                  {post.category && (
                    <Badge variant="secondary" className="mb-3 capitalize">
                      {post.category}
                    </Badge>
                  )}
                  <h2 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {post.excerpt}
                    </p>
                  )}
                  {post.publishedAt && (
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.publishedAt), {
                        addSuffix: true,
                        locale: lang === "ar" ? arLocale : undefined,
                      })}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
