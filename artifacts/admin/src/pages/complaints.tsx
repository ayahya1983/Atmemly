import { useState } from "react";
import { useAdminListComplaints, type Complaint } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "@/lib/i18n";
import { DataTable, type Column, StatusBadge, PageHeader, FilterBar } from "@/components/admin";

type ComplaintRow = Complaint;

export default function AdminComplaints() {
  const { lang } = useTranslation();
  const { data, isLoading } = useAdminListComplaints();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = (data ?? []).filter((c) => statusFilter === "all" || c.status === statusFilter);

  const columns: Column<ComplaintRow>[] = [
    {
      key: "createdAt",
      header: lang === "ar" ? "التاريخ" : "Date",
      cell: (c) => <span className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(c.createdAt))} {lang === "ar" ? "مضت" : "ago"}</span>,
      sortValue: (c) => new Date(c.createdAt).getTime(),
    },
    {
      key: "fromUserName",
      header: lang === "ar" ? "من" : "From",
      cell: (c) => <span className="font-medium">{c.fromUserName}</span>,
      sortValue: (c) => c.fromUserName ?? "",
      searchValue: (c) => c.fromUserName ?? "",
    },
    {
      key: "subject",
      header: lang === "ar" ? "الموضوع" : "Subject",
      cell: (c) => c.subject,
      sortValue: (c) => c.subject ?? "",
      searchValue: (c) => c.subject ?? "",
    },
    {
      key: "status",
      header: lang === "ar" ? "الحالة" : "Status",
      cell: (c) => <StatusBadge status={c.status} />,
      sortValue: (c) => c.status,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={lang === "ar" ? "الشكاوى" : "Complaints"} />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "ابحث بالموضوع أو المرسل" : "Search subject or sender"}
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
          <option value="resolved">Resolved</option>
        </select>
      </FilterBar>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(c) => c.id}
        isLoading={isLoading}
        search={search}
        csvFilename="complaints.csv"
      />
    </div>
  );
}
