import { useTranslation } from "@/lib/i18n";
import { useCmsPage } from "@/lib/api-public";
import { Skeleton } from "@/components/ui/skeleton";

interface StaticCmsPageProps {
  slug: string;
  fallbackTitle: string;
  fallbackBody: string;
}

export function StaticCmsPage({ slug, fallbackTitle, fallbackBody }: StaticCmsPageProps) {
  const { lang } = useTranslation();
  const { data, isLoading, error } = useCmsPage(slug, lang);

  const title = data?.title ?? fallbackTitle;
  const body = data?.body ?? fallbackBody;

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
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
          <h1 className="text-4xl font-bold mb-8">{title}</h1>
          {error ? (
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
