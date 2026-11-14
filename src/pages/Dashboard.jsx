import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../Auth/AuthContext";

const LOGIN_URL = `${import.meta.env.VITE_API_URL}/oauth2/authorization/github`;
const PAGE_SIZE = 24;

const STATUS = {
  none: { label: "Not indexed", cls: "border-surface-3 text-muted" },
  indexing: { label: "Indexing", cls: "border-surface-3 text-muted motion-safe:animate-pulse" },
  ready: { label: "Ready", cls: "border-white text-white" },
  failed: { label: "Failed", cls: "border-[#c98a8a] text-[#c98a8a]" },
};

const VISIBILITY = [["all", "All"], ["public", "Public"], ["private", "Private"]];
const STATUSES = [["all", "All"], ["ready", "Ready"], ["indexing", "Indexing"], ["none", "Not indexed"], ["failed", "Failed"]];

const btn =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition duration-300 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const btnPrimary = `${btn} bg-white text-black hover:opacity-90`;
const btnGhost = `${btn} border border-line text-white hover:bg-surface-3`;
const btnDanger = `${btn} border border-[#c98a8a] text-[#c98a8a] hover:bg-surface-3`;

const statusOf = (r) => (STATUS[r.indexStatus] ? r.indexStatus : "none");

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="flex rounded-lg border border-surface-3 bg-surface p-0.5">
        {options.map(([key, text]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-pressed={value === key}
            className={`rounded-md px-3 py-1 text-xs font-medium transition duration-300 focus-visible:outline-2 focus-visible:outline-white ${
              value === key ? "bg-white text-black" : "text-muted hover:text-white"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Notice({ icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-surface-3 bg-surface px-6 py-16 text-center">
      <div className="mb-4 grid size-10 place-items-center rounded-lg bg-surface-3 text-xl">
        <i className={`ph ${icon}`} aria-hidden="true" />
      </div>
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function RepoCard({ r, index, onIndex, onSync, onRemove }) {
  const key = statusOf(r);
  const s = STATUS[key];
  const [confirming, setConfirming] = useState(false);
  const [owner, name] = r.fullName.includes("/") ? r.fullName.split("/") : ["", r.fullName];
  const pct = r.filesTotal > 0 ? Math.min(100, Math.round((r.filesProcessed / r.filesTotal) * 100)) : 0;

  return (
    <li
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      className="group flex flex-col rounded-2xl border border-surface-3 bg-surface p-6 transition-colors duration-300 hover:border-line motion-safe:animate-rise"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-surface-3 bg-surface-2 text-lg text-muted transition-colors duration-300 group-hover:text-white">
          <i className={`ph ${r.isPrivate ? "ph-lock" : "ph-git-branch"}`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          {owner && <p className="truncate text-xs text-muted">{owner}</p>}
          <h3 className="truncate text-lg font-medium" title={r.fullName}>{name}</h3>
        </div>
        <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
      </div>

      <p className={`mt-4 line-clamp-2 min-h-10 text-sm ${r.description ? "text-white/80" : "text-muted"}`}>
        {r.description || "No description provided."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
        {r.defaultBranch && (
          <span className="inline-flex items-center gap-1 rounded-lg border border-surface-3 px-2 py-0.5 font-mono">
            <i className="ph ph-git-branch" aria-hidden="true" />
            {r.defaultBranch}
          </span>
        )}
        {r.language && (
          <span className="inline-flex items-center gap-2 rounded-lg border border-surface-3 px-2 py-0.5">
            <span className="size-1.5 rounded-full bg-muted" aria-hidden="true" />
            {r.language}
          </span>
        )}
        {key === "ready" && r.chunkCount > 0 && <span>{r.chunkCount} chunks</span>}
      </div>

      {key === "indexing" && (
        <div className="mt-4">
          <div
            role="progressbar"
            aria-label="Indexing progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="h-1 overflow-hidden rounded-full bg-surface-3"
          >
            <div
              className={`h-full bg-white transition-[width] duration-500 ${r.filesTotal === 0 ? "w-1/4 motion-safe:animate-pulse" : ""}`}
              style={r.filesTotal > 0 ? { width: `${pct}%` } : undefined}
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            {r.filesTotal > 0 ? `${r.filesProcessed} of ${r.filesTotal} files` : "Preparing…"}
          </p>
        </div>
      )}

      {key === "failed" && r.errorMessage && (
        <p className="mt-4 line-clamp-2 text-xs text-[#c98a8a]" title={r.errorMessage}>
          {r.errorMessage}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-surface-3 pt-4">
        <a
          href={`https://github.com/${r.fullName}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-muted transition-colors duration-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <i className="ph ph-arrow-square-out" aria-hidden="true" />
          GitHub
        </a>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {confirming ? (
            <>
              <span className="text-xs text-muted">Delete index and chat?</span>
              <button
                onClick={() => {
                  setConfirming(false);
                  onRemove(r.id);
                }}
                className={btnDanger}
              >
                Remove
              </button>
              <button onClick={() => setConfirming(false)} className={btnGhost}>Cancel</button>
            </>
          ) : (
            <>
              {key === "ready" && (
                <>
                  <button onClick={() => onSync(r.id)} className={btnGhost} title="Re-index if there are new commits">
                    <i className="ph ph-arrows-clockwise" aria-hidden="true" />
                    Sync
                  </button>
                  <Link to={`/repos/${r.id}`} className={btnPrimary}>
                    <i className="ph ph-chat-circle-text" aria-hidden="true" />
                    Ask
                  </Link>
                </>
              )}
              {(key === "none" || key === "failed") && (
                <button onClick={() => onIndex(r.id)} className={btnGhost}>
                  <i className="ph ph-sparkle" aria-hidden="true" />
                  {key === "failed" ? "Retry" : "Index"}
                </button>
              )}
              {key === "indexing" && (
                <span className={`${btn} cursor-default border border-surface-3 text-muted`}>Working</span>
              )}
              {(key === "ready" || key === "failed") && (
                <button
                  onClick={() => setConfirming(true)}
                  aria-label={`Remove ${r.fullName}`}
                  title="Remove index and chat history"
                  className="grid size-9 place-items-center rounded-lg text-muted transition-colors duration-300 hover:bg-surface-3 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                >
                  <i className="ph ph-trash" aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

export default function Dashboard() {
  const { user, logout, refresh } = useAuth();
  const [repos, setRepos] = useState([]);
  const [state, setState] = useState("loading"); // loading | ready | error | reconnect
  const [reloading, setReloading] = useState(false);
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [status, setStatus] = useState("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef();

  function flash(text) {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4000);
  }
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const load = useCallback(async () => {
    try {
      setRepos(await api("/api/repos"));
      setState("ready");
    } catch (err) {
      if (err.status === 401) {          // session expired: AuthContext flips to anon and RequireAuth redirects
        refresh();
        return;
      }
      // a failed background refresh must not wipe repos that are already on screen
      setState((s) => (err.status === 409 ? "reconnect" : s === "ready" ? s : "error"));
    }
  }, [refresh]);

  useEffect(() => {
    load();
  }, [load]);

  // refresh every 3s while anything is being indexed
  const anyIndexing = repos.some((r) => r.indexStatus === "indexing");
  useEffect(() => {
    if (!anyIndexing) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [anyIndexing, load]);

  async function reload() {
    setReloading(true);
    await load();
    setReloading(false);
  }

  const markIndexing = (id) =>
    setRepos((rs) =>
      rs.map((r) =>
        r.id === id ? { ...r, indexStatus: "indexing", filesProcessed: 0, filesTotal: 0, errorMessage: null } : r
      )
    );

  function onActionError(err) {
    if (err.status === 401) {
      refresh();
      return;
    }
    if (err.status === 429) flash("The indexing queue is busy. Try again in a minute.");
    load(); // 409 and anything else: show the real state
  }

  async function startIndex(id) {
    markIndexing(id);
    try {
      await api(`/api/repos/${id}/index`, { method: "POST" });
    } catch (err) {
      onActionError(err);
    }
  }

  async function syncRepo(id) {
    try {
      const res = await api(`/api/repos/${id}/sync`, { method: "POST" });
      if (res?.status === "up_to_date") flash("Already up to date with the latest commit.");
      else markIndexing(id);
    } catch (err) {
      onActionError(err);
    }
  }

  async function removeRepo(id) {
    try {
      await api(`/api/repos/${id}`, { method: "DELETE" });
      setRepos((rs) =>
        rs.map((r) =>
          r.id === id
            ? { ...r, indexStatus: "none", filesProcessed: 0, filesTotal: 0, chunkCount: 0, errorMessage: null }
            : r
        )
      );
      flash("Removed. The index and chat history for that repository were deleted.");
    } catch (err) {
      if (err.status === 409) flash("Wait for indexing to finish before removing.");
      onActionError(err);
    }
  }

  const readyCount = useMemo(() => repos.filter((r) => r.indexStatus === "ready").length, [repos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return repos.filter(
      (r) =>
        (visibility === "all" || (visibility === "private") === !!r.isPrivate) &&
        (status === "all" || statusOf(r) === status) &&
        (!q || r.fullName.toLowerCase().includes(q))
    );
  }, [repos, query, visibility, status]);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [query, visibility, status]);
  const visible = filtered.slice(0, limit);

  const handle = user?.githubname ?? user?.login; // check the key in /api/auth/me
  const initial = (user?.displayname || "?").charAt(0).toUpperCase();
  const avatar = user?.avatar ? (
    <img src={user.avatar} alt="" className="size-8 rounded-full bg-surface-3 object-cover" />
  ) : (
    <span className="grid size-8 place-items-center rounded-full bg-surface-3 text-xs font-semibold">{initial}</span>
  );

  return (
    <div className="min-h-screen bg-canvas font-sans text-white">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-surface-3 bg-canvas p-4 lg:flex">
        <Link to="/dashboard" className="mb-8 flex items-center gap-3 rounded-lg px-3 py-2 focus-visible:outline-2 focus-visible:outline-white">
          <span className="grid size-8 place-items-center rounded-lg bg-surface-3">
            <i className="ph ph-code" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold">CodeReaper</span>
            <span className="block text-xs text-muted">Chat with your code</span>
          </span>
        </Link>

        <nav className="grid gap-1" aria-label="Main">
          <Link
            to="/dashboard"
            aria-current="page"
            className="flex items-center gap-3 rounded-lg bg-surface-3 px-3 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-white"
          >
            <i className="ph ph-folders text-lg" aria-hidden="true" />
            Repositories
          </Link>
        </nav>

        <div className="mt-auto flex items-center gap-3 rounded-xl border border-surface-3 bg-surface p-3">
          {avatar}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.displayname}</p>
            {handle && <p className="truncate text-xs text-muted">@{handle}</p>}
          </div>
          <button onClick={logout} aria-label="Sign out" title="Sign out" className="grid size-8 place-items-center rounded-lg text-muted transition-colors duration-300 hover:bg-surface-3 hover:text-white focus-visible:outline-2 focus-visible:outline-white">
            <i className="ph ph-sign-out text-lg" aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-3 bg-canvas/80 px-6 py-3 backdrop-blur-lg lg:hidden">
        <Link to="/dashboard" className="flex items-center gap-2 text-base font-medium">
          <i className="ph ph-code" aria-hidden="true" />
          CodeReaper
        </Link>
        <div className="flex items-center gap-3">
          {avatar}
          <button onClick={logout} className={btnGhost}>Sign out</button>
        </div>
      </header>

      <main className="px-6 pb-24 pt-8 lg:ml-64 lg:px-8 lg:pt-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Repositories</h1>
            <p className="mt-1 text-sm text-muted">
              {state === "ready" ? `${repos.length} connected · ${readyCount} ready` : "Loading your repositories"}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 md:w-72">
              <i className="ph ph-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search repositories"
                aria-label="Search repositories"
                className="w-full rounded-lg border border-surface-3 bg-surface py-2 pl-10 pr-3 text-sm placeholder:text-muted transition-colors duration-300 focus-visible:border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              />
            </div>
            <button onClick={reload} disabled={reloading} className={`${btnGhost} disabled:opacity-60`}>
              <i className={`ph ph-arrows-clockwise ${reloading ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>

        {notice && (
          <p role="status" className="mb-6 rounded-lg border border-surface-3 bg-surface px-4 py-2 text-sm text-muted">
            {notice}
          </p>
        )}

        {state === "ready" && repos.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-surface-3 pb-6">
            <Segmented label="Visibility" options={VISIBILITY} value={visibility} onChange={setVisibility} />
            <Segmented label="Status" options={STATUSES} value={status} onChange={setStatus} />
          </div>
        )}

        {state === "loading" && (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading repositories">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="h-[236px] rounded-2xl border border-surface-3 bg-surface p-6 motion-safe:animate-pulse">
                <div className="flex gap-3">
                  <div className="size-10 rounded-lg bg-surface-3" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/4 rounded bg-surface-2" />
                    <div className="h-4 w-1/2 rounded bg-surface-3" />
                  </div>
                </div>
                <div className="mt-6 h-3 w-3/4 rounded bg-surface-2" />
                <div className="mt-16 h-8 rounded-lg bg-surface-2" />
              </li>
            ))}
          </ul>
        )}

        {state === "error" && (
          <Notice icon="ph-warning-circle" title="Could not load your repositories" action={<button onClick={load} className={btnPrimary}>Try again</button>}>
            The request to the server failed. Check that the backend is running, then try again.
          </Notice>
        )}

        {state === "reconnect" && (
          <Notice
            icon="ph-github-logo"
            title="Your GitHub connection expired"
            action={
              <a href={LOGIN_URL} className={btnPrimary}>
                <i className="ph ph-github-logo" aria-hidden="true" />
                Reconnect GitHub
              </a>
            }
          >
            Sign in with GitHub again to load your repositories.
          </Notice>
        )}

        {state === "ready" && repos.length === 0 && (
          <Notice icon="ph-folder-open" title="No repositories found" action={<button onClick={reload} className={btnGhost}>Refresh</button>}>
            We could not find any repositories on your GitHub account. Create one on GitHub, then refresh.
          </Notice>
        )}

        {state === "ready" && repos.length > 0 && filtered.length === 0 && (
          <Notice
            icon="ph-magnifying-glass"
            title="No matches"
            action={
              <button
                onClick={() => {
                  setQuery("");
                  setVisibility("all");
                  setStatus("all");
                }}
                className={btnGhost}
              >
                Clear filters
              </button>
            }
          >
            No repositories match your search or filters.
          </Notice>
        )}

        {state === "ready" && visible.length > 0 && (
          <>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((r, i) => (
                <RepoCard
                  key={r.id}
                  r={r}
                  index={i}
                  onIndex={startIndex}
                  onSync={syncRepo}
                  onRemove={removeRepo}
                />
              ))}
            </ul>
            {filtered.length > limit && (
              <div className="mt-8 flex flex-col items-center gap-2">
                <p className="text-xs text-muted">Showing {visible.length} of {filtered.length}</p>
                <button onClick={() => setLimit((l) => l + PAGE_SIZE)} className={btnGhost}>Show more</button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}