import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { Plus, Pencil, Trash2, Star, ExternalLink, Eye, EyeOff } from "lucide-react";
import {
  DataTable, type Column, StatusBadge, PageHeader, FilterBar, ConfirmActionDialog,
} from "@/components/admin";

type Status = "draft" | "published" | "archived";

interface BlogRow {
  id: number; slug: string; locale: string; title: string;
  excerpt: string | null; coverUrl: string | null;
  category: string | null; categoryId: number | null;
  tags: string[] | null;
  isPublished: boolean; isFeatured: boolean; status: Status;
  publishedAt: string | null; updatedAt: string;
}
interface BlogCategory { id: number; slug: string; nameEn: string; nameAr: string; isActive: boolean }

function marketplaceBaseUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.protocol}//${window.location.host}`;
}

export default function AdminCmsBlog() {
  const { lang } = useTranslation();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const { user } = useAuth();
  const canWrite = hasPermission(user, "blog", "write");
  const canDelete = hasPermission(user, "blog", "delete");

  const key = ["admin-blog"];
  const { data, isLoading } = useAdminGet<BlogRow[]>(key, "/admin/blog");
  const { data: cats } = useAdminGet<BlogCategory[]>(["admin-blog-categories"], "/admin/blog/categories");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [localeFilter, setLocaleFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const update = useAdminMutation<{ id: number; status: Status }>(
    ({ id, status }) => adminApi.patch(`/admin/blog/${id}`, { status, isPublished: status === "published" }),
    [key, ["public-blog"], ["public-blog-post"]],
  );
  const del = useAdminMutation<{ id: number }>(
    ({ id }) => adminApi.del(`/admin/blog/${id}`),
    [key, ["public-blog"], ["public-blog-post"]],
  );

  const filtered = useMemo(() => (data ?? []).filter((p) => {
    const status = p.status ?? (p.isPublished ? "published" : "draft");
    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (localeFilter !== "all" && p.locale !== localeFilter) return false;
    if (categoryFilter !== "all" && String(p.categoryId ?? "") !== categoryFilter) return false;
    return true;
  }), [data, statusFilter, localeFilter, categoryFilter]);

  const togglePublish = async (p: BlogRow) => {
    const next: Status = p.isPublished ? "draft" : "published";
    await update.mutateAsync({ id: p.id, status: next });
  };

  const columns: Column<BlogRow>[] = [
    {
      key: "title",
      header: t("العنوان", "Title"),
      cell: (p) => (
        <div className="flex items-center gap-2 min-w-0">
          {p.coverUrl ? (
            <img src={p.coverUrl} alt="" className="w-10 h-10 rounded object-cover bg-muted shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded bg-muted shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-medium truncate max-w-sm" dir={p.locale === "ar" ? "rtl" : "ltr"}>
              {p.isFeatured && <Star className="inline w-3 h-3 mr-1 text-yellow-500 fill-yellow-500" />}
              {p.title}
            </div>
            <div className="text-xs text-muted-foreground truncate"><code>{p.slug}</code></div>
          </div>
        </div>
      ),
      sortValue: (p) => p.title,
      searchValue: (p) => `${p.title} ${p.slug} ${p.excerpt ?? ""}`,
    },
    {
      key: "category",
      header: t("الفئة", "Category"),
      cell: (p) => {
        const cat = cats?.find((c) => c.id === p.categoryId);
        return cat ? (lang === "ar" ? cat.nameAr : cat.nameEn) : (p.category ?? "—");
      },
      sortValue: (p) => p.category ?? "",
    },
    {
      key: "locale",
      header: t("اللغة", "Locale"),
      cell: (p) => <Badge variant="outline" className="uppercase">{p.locale}</Badge>,
      sortValue: (p) => p.locale,
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      cell: (p) => <StatusBadge status={p.status ?? (p.isPublished ? "published" : "draft")} />,
      sortValue: (p) => p.status ?? "",
    },
    {
      key: "publishedAt",
      header: t("تاريخ النشر", "Published"),
      cell: (p) => p.publishedAt
        ? <span className="text-xs text-muted-foreground">{new Date(p.publishedAt).toISOString().slice(0, 10)}</span>
        : <span className="text-xs text-muted-foreground">—</span>,
      sortValue: (p) => p.publishedAt ? new Date(p.publishedAt).getTime() : 0,
    },
    {
      key: "actions",
      header: t("إجراءات", "Actions"),
      align: "end",
      cell: (p) => (
        <div className="flex gap-1 justify-end">
          {p.isPublished && (
            <a href={`${marketplaceBaseUrl()}/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" title={t("معاينة", "Preview")}>
              <Button size="sm" variant="ghost" data-testid={`button-preview-${p.id}`}>
                <ExternalLink className="w-3 h-3" />
              </Button>
            </a>
          )}
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => togglePublish(p)}
              disabled={update.isPending}
              title={p.isPublished ? t("إلغاء النشر", "Unpublish") : t("نشر", "Publish")}
              data-testid={`button-toggle-publish-${p.id}`}
            >
              {p.isPublished ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </Button>
          )}
          {canWrite && (
            <Link href={`/cms/blog/${p.id}`}>
              <Button size="sm" variant="outline" data-testid={`button-edit-${p.id}`}><Pencil className="w-3 h-3" /></Button>
            </Link>
          )}
          {canDelete && (
            <ConfirmActionDialog
              trigger={<Button size="sm" variant="destructive" data-testid={`button-delete-${p.id}`}><Trash2 className="w-3 h-3" /></Button>}
              title={t("حذف المقال؟", "Delete post?")}
              description={p.title}
              destructive
              successMessage={t("تم الحذف", "Deleted")}
              onConfirm={() => del.mutateAsync({ id: p.id })}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("مقالات المدونة", "Blog Posts")}
        description={t("إدارة المقالات: إنشاء، تحرير، نشر، وحذف.", "Create, edit, publish and remove blog posts.")}
        actions={canWrite ? (
          <Link href="/cms/blog/new">
            <Button data-testid="button-new-post">
              <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />{t("مقال جديد", "New Post")}
            </Button>
          </Link>
        ) : undefined}
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("بحث بالعنوان أو المعرف", "Search title or slug")}
        onReset={() => { setSearch(""); setStatusFilter("all"); setLocaleFilter("all"); setCategoryFilter("all"); }}
      >
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | Status)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          data-testid="select-blog-status-filter"
        >
          <option value="all">{t("كل الحالات", "All statuses")}</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={localeFilter}
          onChange={(e) => setLocaleFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          data-testid="select-blog-locale-filter"
        >
          <option value="all">{t("كل اللغات", "All locales")}</option>
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          data-testid="select-blog-category-filter"
        >
          <option value="all">{t("كل الفئات", "All categories")}</option>
          {(cats ?? []).map((c) => (
            <option key={c.id} value={String(c.id)}>{lang === "ar" ? c.nameAr : c.nameEn}</option>
          ))}
        </select>
      </FilterBar>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        search={search}
        emptyTitle={t("لا مقالات", "No posts")}
        csvFilename="blog-posts.csv"
      />
    </div>
  );
}
