import { useState } from "react";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { Trash2 } from "lucide-react";
import {
  DataTable, type Column, PageHeader, FilterBar, ConfirmActionDialog,
} from "@/components/admin";

interface WordRow {
  id: number; word: string; locale: string;
  severity: string; isActive: boolean; createdAt: string;
}

export default function AdminBannedWords() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission(user, "moderation", "write");

  const key = ["admin-banned-words"];
  const { data, isLoading } = useAdminGet<WordRow[]>(key, "/admin/moderation/banned-words");

  const [word, setWord] = useState("");
  const [locale, setLocale] = useState("any");
  const [severity, setSeverity] = useState("med");
  const [search, setSearch] = useState("");
  const [localeFilter, setLocaleFilter] = useState("all");
  const [sevFilter, setSevFilter] = useState("all");

  const addMutation = useAdminMutation<{ word: string; locale: string; severity: string }>(
    (input) => adminApi.post("/admin/moderation/banned-words", input), [key],
  );
  const deleteMutation = useAdminMutation<{ id: number }>(
    ({ id }) => adminApi.del(`/admin/moderation/banned-words/${id}`), [key],
  );

  const filtered = (data ?? []).filter((w) =>
    (localeFilter === "all" || w.locale === localeFilter) &&
    (sevFilter === "all" || w.severity === sevFilter),
  );

  const columns: Column<WordRow>[] = [
    {
      key: "word",
      header: lang === "ar" ? "الكلمة" : "Word",
      cell: (w) => <span className="font-mono">{w.word}</span>,
      sortValue: (w) => w.word,
      searchValue: (w) => w.word,
    },
    {
      key: "locale",
      header: lang === "ar" ? "اللغة" : "Locale",
      cell: (w) => <Badge variant="outline">{w.locale}</Badge>,
      sortValue: (w) => w.locale,
    },
    {
      key: "severity",
      header: lang === "ar" ? "الخطورة" : "Severity",
      cell: (w) => <Badge variant={w.severity === "high" ? "destructive" : "outline"} className="capitalize">{w.severity}</Badge>,
      sortValue: (w) => w.severity,
    },
    {
      key: "actions",
      header: lang === "ar" ? "إجراءات" : "Actions",
      align: "end",
      cell: (w) => canWrite ? (
        <ConfirmActionDialog
          trigger={<Button size="sm" variant="destructive" data-testid={`button-delete-${w.id}`}><Trash2 className="w-3 h-3" /></Button>}
          title={lang === "ar" ? "إزالة الكلمة؟" : "Remove word?"}
          description={w.word}
          destructive
          successMessage={lang === "ar" ? "تم الحذف" : "Removed"}
          onConfirm={() => deleteMutation.mutateAsync({ id: w.id })}
        />
      ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={lang === "ar" ? "الكلمات المحظورة" : "Banned Words"} />

      {canWrite && (
        <Card>
          <CardHeader><CardTitle className="text-base">{lang === "ar" ? "إضافة كلمة" : "Add Word"}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]"><Input placeholder={lang === "ar" ? "الكلمة" : "Word"} value={word} onChange={(e) => setWord(e.target.value)} /></div>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="med">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <Button
                disabled={!word.trim() || addMutation.isPending}
                onClick={() => addMutation.mutate({ word: word.trim(), locale, severity }, {
                  onSuccess: () => { setWord(""); toast({ title: lang === "ar" ? "تمت الإضافة" : "Added" }); },
                  onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
                })}
                data-testid="button-add-word"
              >
                {lang === "ar" ? "إضافة" : "Add"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "بحث الكلمة" : "Search word"}
        onReset={() => { setSearch(""); setLocaleFilter("all"); setSevFilter("all"); }}
      >
        <select value={localeFilter} onChange={(e) => setLocaleFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">{lang === "ar" ? "كل اللغات" : "All locales"}</option>
          <option value="any">Any</option>
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </select>
        <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">{lang === "ar" ? "كل المستويات" : "All severities"}</option>
          <option value="low">Low</option>
          <option value="med">Medium</option>
          <option value="high">High</option>
        </select>
      </FilterBar>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(w) => w.id}
        isLoading={isLoading}
        search={search}
        emptyTitle={lang === "ar" ? "لا كلمات" : "No banned words"}
        csvFilename="banned-words.csv"
      />
    </div>
  );
}
