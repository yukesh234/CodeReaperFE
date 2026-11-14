import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../Auth/AuthContext";

const API = import.meta.env.VITE_API_URL;

const SUGGESTIONS = [
  "How is this project structured?",
  "Where is authentication handled?",
  "How do I run this locally?",
];

const btn =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition duration-300 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const btnPrimary = `${btn} bg-white text-black hover:opacity-90 disabled:opacity-40 disabled:hover:opacity-40`;
const btnGhost = `${btn} border border-line text-white hover:bg-surface-3`;

function sourceHref(repo, s) {
  if (!repo?.indexedCommitSha) return null;
  const path = s.path.split("/").map(encodeURIComponent).join("/");
  const line = s.startLine ? `#L${s.startLine}` : "";
  return `https://github.com/${repo.fullName}/blob/${repo.indexedCommitSha}/${path}${line}`;
}

// Minimal SSE reader: yields { event, data } for each frame in a fetch response.
async function* sseEvents(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let event = "message";
      const data = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length) yield { event, data: data.join("\n") };
    }
  }
}

// ---- markdown (React elements only, so nothing is injected as HTML) ----

function inline(text, key) {
  const out = [];
  const re = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(
      tok.startsWith("`") ? (
        <code key={`${key}-${i++}`} className="rounded bg-surface-3 px-1 py-0.5 font-mono text-xs">{tok.slice(1, -1)}</code>
      ) : (
        <strong key={`${key}-${i++}`} className="font-semibold">{tok.slice(2, -2)}</strong>
      )
    );
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Prose({ text }) {
  const nodes = [];
  text.split(/\n{2,}/).forEach((block, bi) => {
    const groups = [];
    for (const line of block.split("\n")) {
      const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
      const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      const type = ul ? "ul" : ol ? "ol" : "p";
      const item = ul ? ul[1] : ol ? ol[1] : line;
      const last = groups[groups.length - 1];
      if (last && last.type === type) last.items.push(item);
      else groups.push({ type, items: [item] });
    }
    groups.forEach((g, gi) => {
      const key = `${bi}-${gi}`;
      if (g.type === "p") {
        const joined = g.items.join("\n").trim();
        if (!joined) return;
        const heading = /^#{1,6}\s+(.*)$/.exec(joined);
        nodes.push(
          heading ? (
            <p key={key} className="font-semibold">{inline(heading[1], key)}</p>
          ) : (
            <p key={key} className="whitespace-pre-wrap">{inline(joined, key)}</p>
          )
        );
      } else {
        const Tag = g.type;
        nodes.push(
          <Tag key={key} className={`space-y-1 pl-5 ${g.type === "ul" ? "list-disc" : "list-decimal"}`}>
            {g.items.map((it, ii) => <li key={ii}>{inline(it, `${key}-${ii}`)}</li>)}
          </Tag>
        );
      }
    });
  });
  return nodes;
}

function Answer({ text, streaming }) {
  const parts = text.split(/```[^\n]*\n?/); // even parts: prose, odd parts: code
  return (
    <div className="space-y-3 text-sm leading-6">
      {parts.map((p, i) =>
        i % 2 ? (
          <pre key={i} className="overflow-x-auto rounded-lg border border-surface-3 bg-canvas p-3 font-mono text-xs">
            <code>{p.replace(/\n$/, "")}</code>
          </pre>
        ) : (
          <Prose key={i} text={p} />
        )
      )}
      {streaming && <span className="inline-block motion-safe:animate-pulse" aria-hidden="true">▍</span>}
    </div>
  );
}

function Sources({ repo, sources }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {sources.map((s) => {
        const href = sourceHref(repo, s);
        const label = s.startLine ? `${s.path}:${s.startLine}` : s.path;
        const cls = "inline-flex max-w-full items-center gap-1 rounded-lg border border-surface-3 px-2 py-0.5 font-mono text-xs text-muted";
        const inner = (
          <>
            <i className="ph ph-file-code shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </>
        );
        return href ? (
          <a key={s.path} href={href} target="_blank" rel="noreferrer" title={label}
             className={`${cls} transition-colors duration-300 hover:text-white focus-visible:outline-2 focus-visible:outline-white`}>
            {inner}
          </a>
        ) : (
          <span key={s.path} title={label} className={cls}>{inner}</span>
        );
      })}
    </div>
  );
}

function Centered({ icon, title, children, action }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <div className="mb-4 grid size-10 place-items-center rounded-lg bg-surface-3 text-xl">
        <i className={`ph ${icon}`} aria-hidden="true" />
      </div>
      <h1 className="text-lg font-medium">{title}</h1>
      <p className="mt-1 text-sm text-muted">{children}</p>
      <div className="mt-6">{action}</div>
    </div>
  );
}

const backToDashboard = (
  <Link to="/dashboard" className={btnGhost}>
    <i className="ph ph-arrow-left" aria-hidden="true" />
    Back to repositories
  </Link>
);

export default function RepoChat() {
  const { id } = useParams();
  const { refresh } = useAuth();

  const [repo, setRepo] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | notready | missing | error
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const localId = useRef(0);
  const abortRef = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // load the repo's status, then its saved conversation
  useEffect(() => {
    let alive = true;
    setPhase("loading");
    api(`/api/repos/${id}/status`)
      .then((s) => {
        if (!alive) return;
        setRepo(s);
        setPhase(s.status === "ready" ? "ready" : "notready");
        if (s.status !== "ready") return;
        api(`/api/repos/${id}/messages`)
          .then((list) => {
            if (alive) setMessages(list.map((m) => ({ id: m.id, role: m.role, text: m.content, sources: m.sources ?? [] })));
          })
          .catch(() => {});
      })
      .catch((err) => {
        if (!alive) return;
        if (err.status === 401) refresh();
        else setPhase(err.status === 404 ? "missing" : "error");
      });
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, [id, refresh]);

  // keep the newest text in view; no smooth scrolling while tokens arrive
  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: calm || sending ? "auto" : "smooth", block: "end" });
  }, [messages, sending]);

  // textarea grows with its content, up to a limit
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const send = useCallback(
    async (text) => {
      const question = text.trim();
      if (!question || sending) return;

      const aid = `local-${localId.current++}`;
      const patch = (fn) => setMessages((ms) => ms.map((m) => (m.id === aid ? fn(m) : m)));
      setMessages((ms) => [
        ...ms,
        { id: `local-${localId.current++}`, role: "user", text: question },
        { id: aid, role: "assistant", text: "", sources: [], streaming: true },
      ]);
      setInput("");
      setSending(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      let finished = false;
      const fail = (message) => patch((m) => ({ ...m, streaming: false, error: true, errorText: message, question }));

      try {
        const res = await fetch(`${API}/api/repos/${id}/ask/stream`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ question }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const e = new Error(`HTTP ${res.status}`);
          e.status = res.status;
          throw e;
        }
        for await (const ev of sseEvents(res)) {
          const data = JSON.parse(ev.data);
          if (ev.event === "sources") patch((m) => ({ ...m, sources: data.sources ?? [] }));
          else if (ev.event === "token") patch((m) => ({ ...m, text: m.text + data.t }));
          else if (ev.event === "done") {
            finished = true;
            patch((m) => ({ ...m, streaming: false }));
          } else if (ev.event === "error") {
            finished = true;
            fail(data.message);
          }
        }
        if (!finished) fail("The connection was interrupted.");
      } catch (err) {
        if (err.name === "AbortError") {
          patch((m) => ({ ...m, streaming: false, stopped: true }));
          return;
        }
        if (err.status === 401) {
          refresh();
          return;
        }
        fail(
          err.status === 429
            ? "Too many questions right now. Wait a moment and try again."
            : "Something went wrong while answering. Try again."
        );
      } finally {
        setSending(false);
        abortRef.current = null;
        inputRef.current?.focus();
      }
    },
    [id, sending, refresh]
  );

  function retry(m) {
    setMessages((ms) => {
      const i = ms.findIndex((x) => x.id === m.id);
      return ms.filter((_, idx) => idx !== i && idx !== i - 1); // drop the failed pair, then ask again
    });
    send(m.question);
  }

  async function newChat() {
    try {
      await api(`/api/repos/${id}/messages`, { method: "DELETE" });
      setMessages([]);
    } catch {
      /* keep the conversation if deleting failed */
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  }

  if (phase === "loading") {
    return <div className="grid min-h-screen place-items-center bg-canvas text-sm text-muted" aria-busy="true">Loading…</div>;
  }

  const shell = (children) => <div className="min-h-screen bg-canvas font-sans text-white">{children}</div>;

  if (phase === "missing")
    return shell(<Centered icon="ph-folder-open" title="Repository not found" action={backToDashboard}>
      This repository hasn't been indexed yet, or it doesn't belong to your account.
    </Centered>);
  if (phase === "error")
    return shell(<Centered icon="ph-warning-circle" title="Could not load this repository" action={backToDashboard}>
      Check that the backend is running, then try again.
    </Centered>);
  if (phase === "notready")
    return shell(<Centered icon="ph-hourglass" title={repo?.status === "indexing" ? "Still indexing" : "Not ready yet"} action={backToDashboard}>
      {repo?.status === "failed"
        ? "Indexing failed for this repository. Go back and retry it."
        : "You can ask questions once indexing has finished."}
    </Centered>);

  return (
    <div className="flex h-screen flex-col bg-canvas font-sans text-white">
      <header className="flex items-center gap-3 border-b border-surface-3 px-6 py-3">
        <Link to="/dashboard" aria-label="Back to repositories"
              className="grid size-8 place-items-center rounded-lg text-muted transition-colors duration-300 hover:bg-surface-3 hover:text-white focus-visible:outline-2 focus-visible:outline-white">
          <i className="ph ph-arrow-left text-lg" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-mono text-sm font-medium">{repo.fullName}</h1>
          <p className="text-xs text-muted">{repo.chunkCount} chunks indexed</p>
        </div>
        {messages.length > 0 && (
          <button onClick={newChat} disabled={sending} className={`${btnGhost} disabled:opacity-40`}>
            New chat
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-3xl">
          {messages.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 grid size-10 place-items-center rounded-lg bg-surface-3 text-xl">
                <i className="ph ph-chat-circle-text" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-semibold">Ask about {repo?.fullName?.split("/")[1] ?? repo.fullName}</h2>
              <p className="mt-1 text-sm text-muted">Answers come from the code in this repository.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className={btnGhost}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-6" aria-label="Conversation">
              {messages.map((m) => (
                <li key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                  {m.role === "user" ? (
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-surface-3 px-4 py-2 text-sm">{m.text}</p>
                  ) : (
                    <div className="max-w-full rounded-2xl border border-surface-3 bg-surface px-4 py-3" aria-busy={!!m.streaming}>
                      {m.text ? (
                        <Answer text={m.text} streaming={m.streaming} />
                      ) : m.streaming ? (
                        <p className="text-sm text-muted motion-safe:animate-pulse">Thinking…</p>
                      ) : null}
                      {m.error && (
                        <p className="mt-2 text-sm text-[#c98a8a]">
                          {m.errorText}{" "}
                          <button onClick={() => retry(m)} className="text-white underline">Retry</button>
                        </p>
                      )}
                      {m.stopped && <p className="mt-2 text-xs text-muted">Stopped.</p>}
                      {!m.error && <Sources repo={repo} sources={m.sources} />}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div ref={endRef} />
        </div>
      </main>

      <footer className="border-t border-surface-3 px-6 py-4">
        <form className="mx-auto flex max-w-3xl items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={2000}
            placeholder="Ask a question about the code"
            aria-label="Your question"
            className="max-h-40 flex-1 resize-none rounded-lg border border-surface-3 bg-surface px-3 py-2 text-sm placeholder:text-muted focus-visible:border-line focus-visible:outline-none"
          />
          {sending ? (
            <button type="button" onClick={() => abortRef.current?.abort()} className={btnGhost}>
              <i className="ph ph-stop" aria-hidden="true" />
              Stop
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className={btnPrimary}>
              <i className="ph ph-paper-plane-right" aria-hidden="true" />
              Send
            </button>
          )}
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-xs text-muted">Enter to send, Shift+Enter for a new line.</p>
      </footer>
    </div>
  );
}