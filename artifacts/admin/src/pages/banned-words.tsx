import { useState } from "react";
import { PageHeader } from "@/components/admin";
import { useAdminGet, useAdminMutation, adminApi } from "@/lib/api-admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { Trash2 } from "lucide-react";

interface WordRow {
  id: number; word: string; locale: string;
  severity: string; isActive: boolean; createdAt: string;
}

export default function AdminBannedWords() {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const key = ["admin-banned-words"];
  const { data, isLoading } = useAdminGet<WordRow[]>(key, "/admin/moderation/banned-words");

  const [word, setWord] = useState("");
  const [locale, setLocale] = useState("any");
  const [severity, setSeverity] = useState("med");

  const addMutation = useAdminMutation<{ word: string; locale: string; severity: string }>(
    (input) => adminApi.post("/admin/moderation/banned-words", input), [key],
  );
  const deleteMutation = useAdminMutation<{ id: number }>(
    ({ id }) => adminApi.del(`/admin/moderation/banned-words/${id}`), [key],
  );

  return (
    <div className="space-y-6">
      <PageHeader title={lang === "ar" ? "الكلمات المحظورة" : "Banned Words"} />

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
            <Button disabled={!word.trim() || addMutation.isPending} onClick={() => addMutation.mutate({ word: word.trim(), locale, severity }, {
              onSuccess: () => { setWord(""); toast({ title: lang === "ar" ? "تمت الإضافة" : "Added" }); },
              onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
            })}>{lang === "ar" ? "إضافة" : "Add"}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{lang === "ar" ? "الكلمة" : "Word"}</TableHead>
              <TableHead>{lang === "ar" ? "اللغة" : "Locale"}</TableHead>
              <TableHead>{lang === "ar" ? "الخطورة" : "Severity"}</TableHead>
              <TableHead>{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-8" /></TableCell></TableRow>
              : !data?.length ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{lang === "ar" ? "لا كلمات" : "No banned words"}</TableCell></TableRow>
              : data.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono">{w.word}</TableCell>
                  <TableCell><Badge variant="outline">{w.locale}</Badge></TableCell>
                  <TableCell><Badge variant={w.severity === "high" ? "destructive" : "outline"} className="capitalize">{w.severity}</Badge></TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="sm" variant="destructive"><Trash2 className="w-3 h-3" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>{lang === "ar" ? "إزالة الكلمة؟" : "Remove word?"}</AlertDialogTitle><AlertDialogDescription>{w.word}</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{lang === "ar" ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate({ id: w.id }, {
                            onSuccess: () => toast({ title: lang === "ar" ? "تم الحذف" : "Removed" }),
                            onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
                          })}>{lang === "ar" ? "إزالة" : "Remove"}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
