import { Link } from "wouter";
import { useTranslation } from "@/lib/i18n";
import { useBlogPosts } from "@/lib/api-public";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale } from "date-fns/locale";

export default function Blog() {
  const { lang } = useTranslation();
  const { data: posts, isLoading } = useBlogPosts(lang);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-3">{lang === "ar" ? "المدونة" : "Blog"}</h1>
        <p className="text-muted-foreground">
          {lang === "ar"
            ? "أحدث الرؤى والنصائح حول العمل الحر في منطقة الخليج."
            : "Latest insights and tips for freelance work in the GCC."}
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : !posts || posts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            {lang === "ar" ? "لا توجد مقالات منشورة بعد." : "No blog posts published yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
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
