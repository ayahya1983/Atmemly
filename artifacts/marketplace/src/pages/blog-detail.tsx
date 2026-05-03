import { Link, useParams } from "wouter";
import { useTranslation } from "@/lib/i18n";
import { useBlogPost, useBlogCategories } from "@/lib/api-public";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import { SeoHead } from "@/components/SeoHead";

export default function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { lang } = useTranslation();
  const { data: post, isLoading, error } = useBlogPost(slug ?? "", lang);
  const { data: categories } = useBlogCategories();
  const cat = post?.categoryId ? categories?.find((c) => c.id === post.categoryId) : undefined;
  const catSeoTitle = cat ? (lang === "ar" ? cat.seoTitleAr : cat.seoTitleEn) : null;
  const catSeoDescription = cat ? (lang === "ar" ? cat.seoDescriptionAr : cat.seoDescriptionEn) : null;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Skeleton className="h-6 w-32 mb-6" />
        <Skeleton className="h-12 w-3/4 mb-4" />
        <Skeleton className="h-4 w-48 mb-8" />
        <Skeleton className="aspect-video w-full mb-6" />
        <Skeleton className="h-4 w-full mb-3" />
        <Skeleton className="h-4 w-full mb-3" />
        <Skeleton className="h-4 w-5/6 mb-3" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-3xl text-center">
        <h1 className="text-2xl font-bold mb-4">
          {lang === "ar" ? "المقال غير موجود" : "Post not found"}
        </h1>
        <Link href="/blog">
          <Button variant="outline">{lang === "ar" ? "العودة للمدونة" : "Back to Blog"}</Button>
        </Link>
      </div>
    );
  }

  return (
    <article className="container mx-auto px-4 py-12 max-w-3xl">
      <SeoHead
        title={post.seoTitle || catSeoTitle || post.title}
        description={post.seoDescription ?? catSeoDescription ?? post.excerpt ?? undefined}
        image={post.coverUrl ?? undefined}
      />
      <Link href="/blog">
        <Button variant="ghost" size="sm" className="mb-6 gap-2">
          <ArrowLeft className="w-4 h-4" />
          {lang === "ar" ? "العودة للمدونة" : "Back to Blog"}
        </Button>
      </Link>

      {post.category && (
        <Badge variant="secondary" className="mb-4 capitalize">
          {post.category}
        </Badge>
      )}

      <h1 className="text-4xl font-bold mb-3">{post.title}</h1>

      {post.publishedAt && (
        <p className="text-sm text-muted-foreground mb-8">
          {format(new Date(post.publishedAt), "MMMM d, yyyy", {
            locale: lang === "ar" ? arLocale : undefined,
          })}
        </p>
      )}

      {post.coverUrl && (
        <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-8">
          <img src={post.coverUrl} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}

      {post.excerpt && (
        <p className="text-lg text-muted-foreground mb-6 italic">{post.excerpt}</p>
      )}

      <div
        className="prose prose-slate max-w-none"
        dangerouslySetInnerHTML={{ __html: post.body }}
      />

      {post.tags && post.tags.length > 0 && (
        <div className="mt-10 pt-6 border-t flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </article>
  );
}
