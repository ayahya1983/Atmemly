import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/lib/i18n";
import { adminApi, useAdminGet, useAdminMutation } from "@/lib/api-admin";

interface AdminNotification {
  id: number;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const LIST_KEY = ["admin-notifications"] as const;
const COUNT_KEY = ["admin-notifications-unread-count"] as const;

function formatRelative(iso: string, lang: "en" | "ar"): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (lang === "ar") {
    if (mins < 1) return "الآن";
    if (mins < 60) return `قبل ${mins} د`;
    if (hours < 24) return `قبل ${hours} س`;
    return `قبل ${days} ي`;
  }
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function NotificationsBell() {
  const { lang } = useTranslation();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const { data: notifications, isLoading } = useAdminGet<AdminNotification[]>(
    LIST_KEY,
    "/notifications",
    { refetchInterval: 60_000 },
  );
  const { data: countData } = useAdminGet<{ count: number }>(
    COUNT_KEY,
    "/notifications/unread-count",
    { refetchInterval: 30_000 },
  );

  const markRead = useAdminMutation<number, AdminNotification>(
    (id) => adminApi.patch<AdminNotification>(`/notifications/${id}/read`),
    [LIST_KEY, COUNT_KEY],
  );
  const markAllRead = useAdminMutation<void, null>(
    () => adminApi.post(`/notifications/read-all`),
    [LIST_KEY, COUNT_KEY],
  );

  const unread = countData?.count ?? 0;
  const items = notifications ?? [];

  function handleClick(n: AdminNotification) {
    if (!n.read) {
      markRead.mutate(n.id);
      // Optimistic count update.
      qc.setQueryData<{ count: number }>(COUNT_KEY, (prev) => ({
        count: Math.max(0, (prev?.count ?? 0) - 1),
      }));
    }
    if (n.link) {
      // Internal links start with `/`; external open in new tab.
      if (/^https?:\/\//i.test(n.link)) {
        window.open(n.link, "_blank", "noopener,noreferrer");
      } else {
        setLocation(n.link);
      }
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={lang === "ar" ? "الإشعارات" : "Notifications"}
          data-testid="button-notifications"
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span
              className="absolute -top-0.5 ltr:-right-0.5 rtl:-left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium flex items-center justify-center"
              data-testid="badge-notifications-unread"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <DropdownMenuLabel className="flex items-center justify-between gap-2 py-3">
          <span className="font-medium">
            {lang === "ar" ? "الإشعارات" : "Notifications"}
            {unread > 0 && (
              <span className="ltr:ml-2 rtl:mr-2 text-xs font-normal text-muted-foreground">
                ({unread} {lang === "ar" ? "غير مقروء" : "unread"})
              </span>
            )}
          </span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                markAllRead.mutate();
                qc.setQueryData<{ count: number }>(COUNT_KEY, { count: 0 });
              }}
              disabled={markAllRead.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="w-3.5 h-3.5 ltr:mr-1 rtl:ml-1" />
              {lang === "ar" ? "تعليم الكل" : "Mark all read"}
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="py-8 flex items-center justify-center text-sm text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {lang === "ar" ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {lang === "ar" ? "لا توجد إشعارات جديدة" : "No notifications"}
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClick(n)}
                className={`w-full text-start px-3 py-3 border-b border-border last:border-0 hover-elevate flex items-start gap-3 ${n.read ? "" : "bg-accent/30"}`}
                data-testid={`notification-item-${n.id}`}
              >
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-primary"}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    <div className="text-[10px] text-muted-foreground shrink-0">
                      {formatRelative(n.createdAt, lang)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>
                </div>
                {!n.read && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      markRead.mutate(n.id);
                      qc.setQueryData<{ count: number }>(COUNT_KEY, (prev) => ({
                        count: Math.max(0, (prev?.count ?? 0) - 1),
                      }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        markRead.mutate(n.id);
                      }
                    }}
                    className="p-1 rounded hover-elevate text-muted-foreground"
                    aria-label={lang === "ar" ? "تعليم كمقروء" : "Mark as read"}
                    data-testid={`button-mark-read-${n.id}`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
