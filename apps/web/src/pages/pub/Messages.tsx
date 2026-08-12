import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, ArrowRight } from "lucide-react";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/utils";
import { Card, CardHeader, EmptyState, PageLoader } from "../../components/ui";

interface ThreadRow {
  thread_type: string;
  thread_id: string;
  last_at: string;
  last_body: string | null;
  message_count: number;
}

export function PubMessagesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["threads"],
    queryFn: () => api.get<ThreadRow[]>("/api/messages/threads"),
  });

  if (isLoading) return <PageLoader />;
  const rows = (data ?? []).filter((t) => t.thread_type !== "support");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Messages</h1>
        <p className="mt-1 text-sm text-ink-500">Conversations about your bookings — with the advertiser and the agency.</p>
      </div>
      <Card>
        <CardHeader title="Conversations" subtitle={`${rows.length} thread(s)`} />
        {!rows.length ? (
          <EmptyState
            icon={<MessageSquare className="h-6 w-6" />}
            title="No conversations yet"
            description="When a booking arrives, its conversation thread appears here."
          />
        ) : (
          <div className="divide-y divide-ink-100">
            {rows.map((t) => (
              <Link key={`${t.thread_type}-${t.thread_id}`} to="/publisher/bookings/$id" params={{ id: t.thread_id }} className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-ink-50">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    {t.thread_type === "campaign" ? "Campaign conversation" : t.thread_type.replace("_", " ")}
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{t.message_count} msgs</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-400">{t.last_body ?? "Attachment"} · {formatDateTime(t.last_at)}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-300" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
