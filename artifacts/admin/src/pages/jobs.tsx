import { useState } from "react";
import { useAdminListJobs, type JobCard } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "@/lib/i18n";
import { DataTable, type Column, StatusBadge, PageHeader, FilterBar } from "@/components/admin";

type JobRow = JobCard;

export default function AdminJobs() {
  const { lang } = useTranslation();
  const { data: jobs, isLoading } = useAdminListJobs();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = (jobs ?? []).filter((j) => statusFilter === "all" || j.status === statusFilter);

  const columns: Column<JobRow>[] = [
    {
      key: "title",
      header: lang === "ar" ? "العنوان" : "Title",
      cell: (j) => <span className="font-medium">{j.title}</span>,
      sortValue: (j) => j.title,
      searchValue: (j) => j.title,
    },
    {
      key: "clientName",
      header: lang === "ar" ? "العميل" : "Client",
      cell: (j) => j.clientName,
      sortValue: (j) => j.clientName ?? "",
      searchValue: (j) => j.clientName ?? "",
    },
    {
      key: "categoryNameEn",
      header: lang === "ar" ? "التصنيف" : "Category",
      cell: (j) => <span className="text-sm text-muted-foreground">{j.categoryNameEn}</span>,
      sortValue: (j) => j.categoryNameEn ?? "",
      searchValue: (j) => j.categoryNameEn ?? "",
    },
    {
      key: "createdAt",
      header: lang === "ar" ? "نُشرت" : "Posted",
      cell: (j) => <span className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(j.createdAt))} {lang === "ar" ? "مضت" : "ago"}</span>,
      sortValue: (j) => new Date(j.createdAt).getTime(),
    },
    {
      key: "status",
      header: lang === "ar" ? "الحالة" : "Status",
      cell: (j) => <StatusBadge status={j.status} />,
      sortValue: (j) => j.status,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={lang === "ar" ? "نظرة على الوظائف" : "Jobs Overview"} />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "ابحث في العنوان أو العميل" : "Search title or client"}
        onReset={() => { setSearch(""); setStatusFilter("all"); }}
      >
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          data-testid="select-status"
        >
          <option value="all">{lang === "ar" ? "كل الحالات" : "All statuses"}</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </FilterBar>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(j) => j.id}
        isLoading={isLoading}
        search={search}
        csvFilename="jobs.csv"
      />
    </div>
  );
}
