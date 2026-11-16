import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../Auth/AuthContext";
import Loader from "../Loader";

const API = import.meta.env.VITE_API_URL;

const LOGIN_URL = `${API}/oauth2/authorization/github`;

const TAGLINE =
  "Stop reading every file to find one answer. Ask the codebase, and see exactly where it came from.";

const BENEFITS = [
  { icon: "ph-chat-circle-text", title: "Onboard faster", body: "Ask how a feature works and get the execution flow explained from the real source." },
  { icon: "ph-magnifying-glass", title: "Find things by meaning", body: "Search for what code does, not what it is called. Ask which files handle a feature and get a list." },
  { icon: "ph-file-code", title: "Trust the answer", body: "Answers include file references, so you can check every claim in one click." },
  { icon: "ph-arrows-clockwise", title: "Keep it current", body: "Sync re-indexes a repository when new commits land, so answers match your latest code." },
];

const STEPS = [
  { title: "Continue with GitHub", body: "Sign in and CodeReaper lists your repositories. Choose the one you want to explore." },
  { title: "Let it index", body: "CodeReaper parses and indexes your code so it can retrieve the right parts later." },
  { title: "Ask in plain English", body: "Get answers grounded in your source, with the files they came from." },
];

const FAQS = [
  ["What can I ask?", "Anything about the repository: how authentication works, where a function lives, how a feature runs, or which files own a behavior."],
  ["How do you avoid made up answers?", "Answers are generated from code retrieved from your repository, and each one cites the files it used so you can verify it. If the code doesn't contain the answer, CodeReaper says so."],
  ["Which languages are supported?", "Java, Kotlin, Scala, C, C++, C#, TypeScript, JavaScript (including JSX and TSX), Go, Python, Rust, Ruby, PHP and Swift, plus Vue and Svelte components. Config and docs such as Markdown, YAML, JSON, XML, Dockerfiles and shell scripts are indexed too. Files over 100 KB, lockfiles and folders like node_modules and build output are skipped."],
  ["Which AI models are used?", "Answers are written by GPT-OSS 120B, an open-weight model, served through Groq. Searching your code uses an open embedding model (all-MiniLM-L6-v2) that runs on the CodeReaper server."],
  ["Is my code safe?", "Sign-in goes through GitHub, and your GitHub token is stored encrypted. File contents are read only for repositories you choose to index. To read private repositories GitHub requires its broad repo permission, and CodeReaper uses it only to read. Indexed code is stored in a database and only your account can search it. When you ask a question, the question and the most relevant excerpts are sent to Groq so the model can write the answer. You can delete a repository's index and chat history from the dashboard at any time, and revoke access in your GitHub settings."],
  ["How much will it cost?", "Free for now. CodeReaper is a personal project and there is no paid plan. Because it runs on free infrastructure, answers can occasionally be slow or rate limited."],
];

const NAV = [
  ["Product", "#benefits"],
  ["How it works", "#how"],
  ["FAQ", "#faq"],
];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".rv");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Tagline() {
  const ref = useRef(null);
  useEffect(() => {
    const words = ref.current.querySelectorAll(".w");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      words.forEach((w) => w.classList.add("on"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("on");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -40% 0px" }
    );
    words.forEach((w) => io.observe(w));
    return () => io.disconnect();
  }, []);

  return (
    <section className="tagline" aria-label="Tagline">
      <div className="wrap">
        <h2 className="heading-2" ref={ref}>
          {TAGLINE.split(" ").map((w, i) => (
            <span key={i}>
              <span className="w">{w}</span>{" "}
            </span>
          ))}
        </h2>
      </div>
    </section>
  );
}

function GithubButton({ className = "", size = "button-md", onStart }) {
  const { status } = useAuth();
  const cls = `btn btn-primary ${size} ${className}`;

  if (status === "authed") {
    return (
      <Link className={cls} to="/dashboard">
        <i className="ph ph-squares-four" aria-hidden="true" />
        Open dashboard
      </Link>
    );
  }
  return (
    <a className={cls} href={LOGIN_URL} onClick={onStart}>
      <i className="ph ph-github-logo" aria-hidden="true" />
      Continue with GitHub
    </a>
  );
}

export default function Landing() {
  const [open, setOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  useReveal();

  useEffect(() => {
    document.body.style.overflow = open || redirecting ? "hidden" : "";
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, redirecting]);

  // coming back with the browser's Back button restores this page from cache, so reset the loader
  useEffect(() => {
    const onShow = (e) => {
      if (e.persisted) setRedirecting(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  function start(e) {
    // let Ctrl/Cmd/Shift/middle clicks open a new tab without showing the loader here
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    setOpen(false);
    setRedirecting(true);
  }

  return (
    <>
      <a className="skip body-6" href="#main">Skip to content</a>

      <header>
        <div className={`nav ${open ? "open" : ""}`}>
          <a className="logo title-3" href="#top" aria-label="CodeReaper home">
            <i className="ph ph-code" aria-hidden="true" />
            CodeReaper
          </a>
          <nav className="nav-links caption-1" aria-label="Primary">
            {NAV.map(([label, href], i) => (
              <a key={href} href={href} aria-current={i === 0 ? "true" : undefined}>{label}</a>
            ))}
          </nav>
          <GithubButton size="button-sm" onStart={start} />
          <button
            className="toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="panel"
            onClick={() => setOpen((o) => !o)}
          >
            <span /><span />
          </button>
        </div>
        <div className={`panel ${open ? "open" : ""}`} id="panel" aria-hidden={!open}>
          {NAV.map(([label, href], i) => (
            <a key={href} className="heading-3" style={{ "--i": i }} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          <GithubButton onStart={start} />
        </div>
      </header>

      <main id="main">
        <section className="hero" id="top">
          <div className="wrap">
            <div className="hero-copy">
              <h1 className="heading-1">Ask your codebase,<br />get answers with receipts</h1>
              <p className="sub body-3">
                Connect your GitHub account, pick a repository and ask questions in plain English. CodeReaper answers from your actual source, with file paths you can check.
              </p>
              <GithubButton onStart={start} />
              <p className="proof caption-1">
                <i className="ph ph-file-code" aria-hidden="true" />
                Every answer links back to the files it came from.
              </p>
            </div>

            <div className="mock rv" aria-label="Example of a CodeReaper answer">
              <div className="mock-bar caption-1">
                <span className="mono">your-org/your-repo</span>
                <span>Example</span>
              </div>
              <div className="mock-grid">
                <div className="pane tree mono caption-1">
                  <ul>
                    <li><i className="ph ph-folder" aria-hidden="true" />src</li>
                    <li className="hit"><i className="ph ph-file-code" aria-hidden="true" />AuthFilter.java</li>
                    <li className="hit"><i className="ph ph-file-code" aria-hidden="true" />TokenService.java</li>
                    <li><i className="ph ph-file-code" aria-hidden="true" />UserController.java</li>
                    <li><i className="ph ph-file-code" aria-hidden="true" />Routes.java</li>
                  </ul>
                </div>
                <div className="pane">
                  <div className="q body-6">How does authentication work?</div>
                  <p className="body-6 muted">
                    Requests pass through <span className="mono" style={{ color: "#fff" }}>AuthFilter</span>, which reads the bearer token and asks <span className="mono" style={{ color: "#fff" }}>TokenService</span> to verify it before the controller runs.
                  </p>
                  <div className="code mono caption-4">{`if (!tokenService.isValid(token)) {
  response.setStatus(401);
  return;
}`}</div>
                  <span className="ref mono caption-4"><i className="ph ph-file-code" aria-hidden="true" />AuthFilter.java</span>
                  <span className="ref mono caption-4"><i className="ph ph-file-code" aria-hidden="true" />TokenService.java</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Tagline />

        <section id="benefits">
          <div className="wrap">
            <div className="sec-head rv">
              <p className="eyebrow caption-1">Why CodeReaper</p>
              <h2 className="heading-3">Understand unfamiliar code in minutes, not days</h2>
            </div>
            <div className="grid g2">
              {BENEFITS.map((b) => (
                <article className="card rv" key={b.title}>
                  <div className="icon"><i className={`ph ${b.icon}`} aria-hidden="true" /></div>
                  <h3 className="title-2">{b.title}</h3>
                  <p className="body-6">{b.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how">
          <div className="wrap">
            <div className="sec-head rv">
              <p className="eyebrow caption-1">How it works</p>
              <h2 className="heading-3">From repository to answers in three steps</h2>
            </div>
            <div className="grid g3">
              {STEPS.map((s, i) => (
                <article className="card rv" key={s.title}>
                  <p className="step-n mono caption-1">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="title-2">{s.title}</h3>
                  <p className="body-6">{s.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq">
          <div className="wrap">
            <div className="sec-head rv">
              <p className="eyebrow caption-1">FAQ</p>
              <h2 className="heading-3">Questions developers ask first</h2>
            </div>
            <div className="faq rv">
              {FAQS.map(([q, a]) => (
                <details key={q}>
                  <summary className="title-3">{q}<i className="ph ph-plus" aria-hidden="true" /></summary>
                  <p className="body-6">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <div className="final rv">
              <h2 className="heading-3">Connect GitHub and ask your first question</h2>
              <p className="body-3">Sign in, pick a repository and start exploring. You choose which repositories to index.</p>
              <GithubButton onStart={start} />
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap foot caption-1">
          <span>© 2026 CodeReaper</span>
        </div>
      </footer>

      {redirecting && (
        <div className="fixed inset-0 z-100">
          <Loader label="Redirecting to GitHub" />
        </div>
      )}
    </>
  );
}