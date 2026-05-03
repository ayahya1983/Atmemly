import { useState } from "react";
import { useAdminListUsers, useAdminUpdateUserStatus, getAdminListUsersQueryKey, type AdminUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Download } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { downloadCsv } from "@/lib/api-admin";
import {
  DataTable, type Column, type BulkAction, StatusBadge, PageHeader, FilterBar, ConfirmActionDialog,
} from "@/components/admin";

type UserRow = AdminUser;

export default function AdminUsers() {
  const { lang } = useTranslation();
  const { user: currentUser } = useAuth();
  const canWrite = hasPermission(currentUser, "users", "write");
  const { data: users, isLoading } = useAdminListUsers();
  const updateStatus = useAdminUpdateUserStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const filtered = (users ?? []).filter((u) => roleFilter === "all" || u.role === roleFilter);

  const setStatusBulk = async (rows: UserRow[], status: "active" | "suspended") => {
    for (const u of rows) {
      if (u.role === "admin") continue;
      await updateStatus.mutateAsync({ id: u.id, data: { status } });
    }
    await queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
    toast({ title: lang === "ar" ? `تم تحديث ${rows.length}` : `${rows.length} updated` });
  };

  const columns: Column<UserRow>[] = [
    {
      key: "fullName",
      header: lang === "ar" ? "الاسم" : "Name",
      cell: (u) => <span className="font-medium">{u.fullName}</span>,
      sortValue: (u) => u.fullName,
      searchValue: (u) => u.fullName,
    },
    {
      key: "email",
      header: lang === "ar" ? "البريد" : "Email",
      cell: (u) => <span className="text-sm text-muted-foreground">{u.email}</span>,
      sortValue: (u) => u.email,
      searchValue: (u) => u.email,
    },
    {
      key: "role",
      header: lang === "ar" ? "الدور" : "Role",
      cell: (u) => <span className="capitalize">{u.role}</span>,
      sortValue: (u) => u.role,
      searchValue: (u) => u.role,
    },
    {
      key: "createdAt",
      header: lang === "ar" ? "انضم" : "Joined",
      cell: (u) => <span className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(u.createdAt))} {lang === "ar" ? "مضت" : "ago"}</span>,
      sortValue: (u) => new Date(u.createdAt).getTime(),
    },
    {
      key: "status",
      header: lang === "ar" ? "الحالة" : "Status",
      cell: (u) => <StatusBadge status={u.status} />,
      sortValue: (u) => u.status,
    },
    {
      key: "actions",
      header: lang === "ar" ? "إجراء" : "Action",
      align: "end",
      cell: (u) => (u.role === "admin" || !canWrite) ? null : (
        <ConfirmActionDialog
          trigger={
            <Button variant="outline" size="sm" data-testid={`button-toggle-${u.id}`}>
              {u.status === "active" ? (lang === "ar" ? "إيقاف" : "Suspend") : (lang === "ar" ? "تفعيل" : "Activate")}
            </Button>
          }
          title={u.status === "active" ? (lang === "ar" ? "إيقاف المستخدم؟" : "Suspend user?") : (lang === "ar" ? "تفعيل المستخدم؟" : "Activate user?")}
          description={`${u.fullName} — ${u.email}`}
          destructive={u.status === "active"}
          onConfirm={async () => {
            const newStatus = u.status === "active" ? "suspended" : "active";
            await updateStatus.mutateAsync({ id: u.id, data: { status: newStatus } });
            await queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
          }}
          successMessage={lang === "ar" ? "تم التحديث" : "User updated"}
        />
      ),
    },
  ];

  const bulkActions: BulkAction<UserRow>[] = canWrite ? [
    { label: lang === "ar" ? "تفعيل" : "Activate", onRun: (rows) => setStatusBulk(rows, "active") },
    { label: lang === "ar" ? "إيقاف" : "Suspend", destructive: true, onRun: (rows) => setStatusBulk(rows, "suspended") },
  ] : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={lang === "ar" ? "إدارة المستخدمين" : "Users Management"}
        description={lang === "ar" ? "بحث، تصفية، وإجراء جماعي على حسابات المنصة." : "Search, filter, and run bulk actions across platform accounts."}
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={lang === "ar" ? "ابحث بالاسم أو البريد" : "Search by name or email"}
        onReset={() => { setSearch(""); setRoleFilter("all"); }}
      >
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          data-testid="select-role"
        >
          <option value="all">{lang === "ar" ? "كل الأدوار" : "All roles"}</option>
          <option value="client">Client</option>
          <option value="freelancer">Freelancer</option>
          <option value="admin">Admin</option>
        </select>
      </FilterBar>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(u) => u.id}
        isLoading={isLoading}
        search={search}
        enableSelection={canWrite}
        bulkActions={bulkActions}
        onCsvExport={() => {
          const params = new URLSearchParams();
          if (search) params.set("q", search);
          if (roleFilter && roleFilter !== "all") params.set("role", roleFilter);
          const qs = params.toString();
          return downloadCsv(`/admin/users.csv${qs ? `?${qs}` : ""}`, "users.csv");
        }}
      />
    </div>
  );
}
