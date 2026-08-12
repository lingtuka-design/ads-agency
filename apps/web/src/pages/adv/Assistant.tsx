import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles, Send, Bot, User2, ArrowRight } from "lucide-react";
import { api } from "../../lib/api";
import { apiErrorMessage } from "../../lib/utils";
import { Card, Input, Button, Spinner } from "../../components/ui";
import { useAuth } from "../../lib/auth";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  matches?: { publisher: string; package: string; price: number; platform: string; score: number; link: string }[];
}

const SUGGESTIONS = [
  "My budget is Rs. 20,000 and I want to advertise a clothing shop for young people for one month.",
  "I have ₹50,000 and want the biggest reach.",
  "Which publisher is best for youth aged 18-30 in Mizoram?",
  "I don't have a flyer. Can your agency create one?",
];

export function AdvAssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: health } = useQuery({
    queryKey: ["ai-health"],
    queryFn: () => api.get<{ gemini_configured: boolean }>("/api/ai/health"),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput("");
    setError("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setSending(true);
    try {
      const res = await api.post<{ reply: string; language: string; used_fallback: boolean; matches: ChatMessage["matches"] }>("/api/ai/chat", {
        message: msg,
        history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply, matches: res.matches }]);
    } catch (e) {
      setError(apiErrorMessage(e));
      setMessages((m) => [...m, { role: "assistant", content: "I'm having trouble connecting right now. Please try again in a moment." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-4xl flex-col">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-sky-500 text-white shadow-lg shadow-brand-600/25">
          <Sparkles className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-ink-900">Ask our Advertising Assistant</h1>
          <p className="text-xs text-ink-500">
            {health?.gemini_configured ? "Powered by Gemini — Mizo & English" : "Recommendation engine active (Gemini key not configured)"} · {user?.name}
          </p>
        </div>
      </div>

      <Card className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
              <div className="max-w-md">
                <p className="text-sm leading-relaxed text-ink-500">
                  I'm your advertising consultant. Tell me your budget, target audience and goals, and I'll recommend real publishers and packages from the marketplace — in English or Mizo.
                </p>
                <p className="mt-2 text-xs text-ink-400">"Ka budget ₹20,000 a ni a, Mizo tlawmngai te an ni."</p>
              </div>
              <div className="grid w-full max-w-md gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-left text-xs text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] ${m.role === "user" ? "" : ""}`}>
                <div className={`flex items-start gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${m.role === "user" ? "bg-ink-900 text-white" : "bg-gradient-to-br from-brand-600 to-sky-500 text-white"}`}>
                    {m.role === "user" ? <User2 className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </span>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "rounded-tr-sm bg-brand-600 text-white" : "rounded-tl-sm border border-ink-200 bg-ink-50 text-ink-800"}`}>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    {m.matches && m.matches.length > 0 && m.role === "assistant" && (
                      <div className="mt-3 space-y-2 border-t border-ink-200/60 pt-3">
                        {m.matches.slice(0, 3).map((mt, j) => (
                          <Link key={j} to={mt.link} className="flex items-center justify-between rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-xs transition-colors hover:border-brand-400">
                            <div>
                              <p className="font-semibold text-ink-900">{mt.publisher} <span className="font-normal text-ink-400">· {mt.platform}</span></p>
                              <p className="text-ink-500">{mt.package}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-brand-700">₹{mt.price.toLocaleString("en-IN")}</p>
                              <p className="text-[10px] font-semibold text-emerald-600">{mt.score}% match</p>
                            </div>
                          </Link>
                        ))}
                        <Link to="/advertiser/publishers" className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline">
                          Browse all publishers <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-sky-500 text-white"><Bot className="h-4 w-4" /></span>
              <div className="flex items-center gap-2 rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3">
                <Spinner className="h-4 w-4" />
                <span className="text-xs text-ink-500">Finding the best publishers…</span>
              </div>
            </div>
          )}
          {error && <p className="text-center text-xs text-red-600">{error}</p>}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-ink-100 p-3">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask about budget, audience, platforms… (Mizo & English)"
              className="flex-1"
            />
            <Button onClick={() => send()} loading={sending} icon={<Send className="h-4 w-4" />}>Send</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
