import { useState } from "react";
import { useListReviews, type Review } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { Star } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { DataTable, type Column, PageHeader, FilterBar } from "@/components/admin";

type ReviewRow = Review;

export default function AdminReviews() {
  const { lang } = useTranslation();
  const { data, isLoading } = useListReviews({});
  const [search, setSearch] = useState("");

  const columns: Column<ReviewRow>[] = [
    {
      key: "createdAt",
      header: lang === "ar" ? "التاريخ" : "Date",
      cell: (r) => <span className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(r.createdAt))} {lang === "ar" ? "مضت" : "ago"}</span>,
      sortValue: (r) => new Date(r.createdAt).getTime(),
    },
    {
      key: "fromUserName",
      header: lang === "ar" ? "من" : "From",
      cell: (r) => <span className="font-medium">{r.fromUserName}</span>,
      sortValue: (r) => r.fromUserName ?? "",
      searchValue: (r) => r.fromUserName ?? "",
    },
    {
      key: "jobTitle",
      header: lang === "ar" ? "الوظيفة" : "Job",
      cell: (r) => r.jobTitle,
      sortValue: (r) => r.jobTitle ?? "",
      searchValue: (r) => r.jobTitle ?? "",
    },
    {
      key: "rating",
      header: lang === "ar" ? "التقييم" : "Rating",
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
          <span className="tabular-nums">{r.rating}</span>
        </div>
      ),
      sortValue: (r) => r.rating,
    },
    {
      key: "comment",
      header: lang === "ar" ? "تعليق" : "Comment",
      cell: (r) => <span className="block max-w-md truncate text-sm">{r.comment}</span>,
      searchValue: (r) => r.comment ?? "",
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={lang === "ar" ? "التقييمات" : "Reviews"} />
      <FilterBar search={search} onSearchChange={setSearch} onReset={() => setSearch("")} />
      <DataTable
        data={data}
        columns={columns}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        search={search}
        csvFilename="reviews.csv"
      />
    </div>
  );
}
