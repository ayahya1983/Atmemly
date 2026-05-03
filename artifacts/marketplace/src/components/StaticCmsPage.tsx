import { useTranslation } from "@/lib/i18n";
import { useCmsPageWithFallback } from "@/lib/api-public";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/SeoHead";
import NotFound from "@/pages/not-found";

interface StaticCmsPageProps {
  slug: string;
  fallbackTitle: string;
  fallbackBody: string;
}

export function StaticCmsPage({ slug, fallbackTitle, fallbackBody }: StaticCmsPageProps) {
  const { lang } = useTranslation();
  const { data, isLoading, isError, isNotFound } = useCmsPageWithFallback(slug, lang);
  const isDev = import.meta.env.DEV;
  // In production, render the standard 404 page when the CMS page is missing
  // in both the requested and fallback locales. In development we keep the
  // hardcoded fallback content so the page is still useful before content is
  // seeded.
  if (isNotFound && !isDev) {
    return <NotFound />;
  }
  const title = data?.title ?? (isDev ? fallbackTitle : "");
  const body = data?.body ?? (isDev ? fallbackBody : "");
  const error = isError && !isNotFound ? new Error("load_failed") : null;

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <SeoHead
        title={data?.seoTitle || title || fallbackTitle}
        description={data?.seoDescription ?? undefined}
      />
      {isLoading ? (
        <>
          <Skeleton className="h-10 w-2/3 mb-8" />
          <Skeleton className="h-4 w-full mb-3" />
          <Skeleton className="h-4 w-full mb-3" />
          <Skeleton className="h-4 w-4/5 mb-3" />
          <Skeleton className="h-4 w-full mb-3" />
        </>
      ) : (
        <>
          <h1 className="text-4xl font-bold mb-8" data-testid={`static-cms-${slug}-title`}>
            {title || (data ? "" : fallbackTitle)}
          </h1>
          {error && !isDev ? (
            <div className="prose prose-slate max-w-none text-muted-foreground">
              <p className="text-sm">
                {lang === "ar"
                  ? "تعذّر تحميل المحتوى حاليًا. يرجى المحاولة لاحقًا."
                  : "Content is temporarily unavailable. Please try again later."}
              </p>
            </div>
          ) : error && isDev ? (
            <div className="prose prose-slate max-w-none text-muted-foreground space-y-6">
              <p className="whitespace-pre-line">{fallbackBody}</p>
            </div>
          ) : (
            <div
              className="prose prose-slate max-w-none text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          )}
        </>
      )}
    </div>
  );
}
