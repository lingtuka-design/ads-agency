import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Paperclip } from "lucide-react";
import { api, uploadFile } from "../lib/api";
import { apiErrorMessage, formatDateTime } from "../lib/utils";
import { Button, Input, Avatar } from "./ui";
import { useAuth } from "../lib/auth";

interface Message {
  id: string;
  sender_id: string;
  sender_role: string;
  body: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  is_system: number;
  created_at: string;
  sender_name: string;
}

export function Thread({ threadType, threadId }: { threadType: "campaign" | "creative_job" | "dispute" | "support"; threadId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [attach, setAttach] = useState<File | null>(null);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["thread", threadType, threadId],
    queryFn: () => api.get<Message[]>(`/api/messages/${threadType}/${threadId}`),
    refetchInterval: 10_000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useMutation({
    mutationFn: async () => {
      let attachment_url: string | null = null;
      let attachment_name: string | null = null;
      if (attach) {
        const up = await uploadFile(attach);
        attachment_url = up.url;
        attachment_name = up.file_name;
      }
      await api.post("/api/messages", {
        thread_type: threadType,
        thread_id: threadId,
        body: text || null,
        attachment_url,
        attachment_name,
      });
    },
    onSuccess: () => {
      setText("");
      setAttach(null);
      qc.invalidateQueries({ queryKey: ["thread", threadType, threadId] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <div className="flex h-[28rem] flex-col">
      <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4">
        {(messages ?? []).map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
              <Avatar name={m.sender_name ?? "?"} size={30} />
              <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                <p className="mb-1 text-[10px] text-ink-400">
                  {m.sender_name} · {m.sender_role} · {formatDateTime(m.created_at)}
                </p>
                <div className={`inline-block rounded-2xl px-3.5 py-2.5 text-left text-sm ${mine ? "rounded-tr-sm bg-brand-600 text-white" : "rounded-tl-sm border border-ink-200 bg-white text-ink-800"}`}>
                  {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                  {m.attachment_url && (
                    <a href={m.attachment_url} target="_blank" rel="noreferrer" className={`mt-1.5 flex items-center gap-1.5 text-xs font-semibold underline ${mine ? "text-brand-100" : "text-brand-600"}`}>
                      <Paperclip className="h-3.5 w-3.5" /> {m.attachment_name ?? "attachment"}
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-ink-100 p-3">
        {attach && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-ink-50 px-3 py-1.5 text-xs">
            <span className="flex items-center gap-1.5 text-ink-600"><Paperclip className="h-3.5 w-3.5" /> {attach.name}</span>
            <button onClick={() => setAttach(null)} className="text-ink-400 hover:text-red-500">Remove</button>
          </div>
        )}
        <div className="flex gap-2">
          <label className="flex cursor-pointer items-center rounded-xl border border-ink-300 px-3 text-ink-500 hover:border-brand-400 hover:text-brand-600" title="Attach file">
            <Paperclip className="h-4 w-4" />
            <input type="file" className="hidden" onChange={(e) => setAttach(e.target.files?.[0] ?? null)} />
          </label>
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send.mutate()} placeholder="Type a message…" />
          <Button onClick={() => send.mutate()} loading={send.isPending} icon={<Send className="h-4 w-4" />}>Send</Button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
