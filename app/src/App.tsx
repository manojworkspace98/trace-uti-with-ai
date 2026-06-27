import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAssets } from "./hooks/useAssets";
import { Predict } from "./components/Predict";
import { Performance } from "./components/Performance";
import { About } from "./components/About";

type Tab = "predict" | "performance" | "about";
const TABS: { id: Tab; label: string }[] = [
  { id: "predict", label: "Predict" },
  { id: "performance", label: "Model performance" },
  { id: "about", label: "About" },
];

function LiquidBackground() {
  return (
    <div className="liquid-bg" aria-hidden>
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#0e7490" />
          </linearGradient>
        </defs>
        <path
          d="M20 3C12 12 7 18 7 25a13 13 0 0026 0c0-7-5-13-13-22z"
          fill="url(#lg)"
        />
        <path
          d="M14 25c0 3.3 2.7 6 6 6"
          fill="none"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.9"
        />
      </svg>
      <div className="leading-none">
        <div className="text-[15px] font-bold tracking-tight text-ink-900">Trace</div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-brand-700">
          UTI antibiotic guidance
        </div>
      </div>
    </div>
  );
}

function DisclaimerBar() {
  return (
    <div className="no-print bg-ink-900 px-4 py-1.5 text-center text-[11px] text-slate-200">
      ⚠️ Research prototype for antimicrobial-stewardship exploration —{" "}
      <strong className="font-semibold text-white">not medical advice</strong>. Always
      confirm with culture &amp; sensitivity and clinical judgement.
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("predict");
  const state = useAssets();

  // Scroll to top whenever the section changes so above-the-fold content is in view.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [tab]);

  return (
    <>
      <LiquidBackground />
      <DisclaimerBar />

      <header className="no-print sticky top-0 z-20 border-b border-white/40 bg-white/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-1 rounded-full bg-white/60 p-1 shadow-sm ring-1 ring-black/5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors sm:px-4"
                aria-current={tab === t.id ? "page" : undefined}
              >
                {tab === t.id && (
                  <motion.span
                    layoutId="navpill"
                    className="absolute inset-0 rounded-full bg-brand-600"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span
                  className={`relative z-10 ${tab === t.id ? "text-white" : "text-ink-700"}`}
                >
                  {t.label}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8">
        {state.status === "loading" && <LoadingState />}
        {state.status === "error" && (
          <ErrorState message={state.error} onRetry={state.retry} />
        )}
        {state.status === "ready" && (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              {tab === "predict" && (
                <Predict schema={state.assets.schema} model={state.assets.model} />
              )}
              {tab === "performance" && <Performance metrics={state.assets.metrics} />}
              {tab === "about" && <About metrics={state.assets.metrics} />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <footer className="no-print border-t border-white/40 py-6 text-center text-xs text-ink-500">
        Built on the MIT/PhysioNet AMR-UTI dataset (Kanjilal et al.). Model runs entirely
        in your browser — no data leaves this page.
      </footer>
    </>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="shimmer h-40 rounded-3xl" />
      <div className="shimmer h-64 rounded-3xl" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass rounded-3xl p-8 text-center">
      <p className="text-lg font-semibold text-danger">Couldn’t load the model.</p>
      <p className="mt-2 text-sm text-ink-500">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Retry
      </button>
    </div>
  );
}
