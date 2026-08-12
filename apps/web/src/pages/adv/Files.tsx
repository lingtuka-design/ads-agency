import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Download } from "lucide-react";
import { api } from "../../lib/api";
import { formatDateTime, formatNumber } from "../../lib/utils";
import { Card, CardHeader, EmptyState, PageLoader } from "../../components/ui";

interface UploadItem {
  id: string;
  key: string;
  file_name: string;
  mime_type: string | null;
  size: number;
  created_at: string;
}

export function AdvFilesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["files"],
    queryFn: () => api.get<UploadItem[]>("/api/uploads/list"),
  });

  if (isLoading) return <PageLoader />;
  const files = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Files</h1>
        <p className="mt-1 text-sm text-ink-500">All files you've uploaded — creatives, references and attachments, stored securely.</p>
      </div>
      <Card>
        <CardHeader title="Your files" subtitle={`${files.length} file(s)`} />
        {!files.length ? (
          <EmptyState
            icon={<FolderOpen className="h-6 w-6" />}
            title="No files yet"
            description="Upload creatives from your campaign pages, or attach files in conversations."
          />
        ) : (
          <div className="divide-y divide-ink-100">
            {files.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">{f.file_name}</p>
                  <p className="text-xs text-ink-400">{f.mime_type ?? "file"} · {formatNumber(f.size)} bytes · {formatDateTime(f.created_at)}</p>
                </div>
                <a href={`/api/uploads/${f.key}`} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-brand-600" title="Download">
                  <Download className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
