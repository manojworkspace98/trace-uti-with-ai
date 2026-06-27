import { useState } from "react";
import { motion } from "framer-motion";
import {
  avatarGradient,
  initials,
  LINKEDIN_ARTICLE,
  MAKEATHON_LINK,
  TEAM,
  type Member,
} from "../lib/team";

const BASE = import.meta.env.BASE_URL;

function LinkedInIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.07 2.07 0 110-4.14 2.07 2.07 0 010 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function Avatar({ member, size = 64 }: { member: Member; size?: number }) {
  const [failed, setFailed] = useState(false);
  const [g1, g2] = avatarGradient(member.name);
  if (failed || !member.hasPhoto) {
    return (
      <div
        className="grid shrink-0 place-items-center rounded-2xl font-bold text-white shadow-sm ring-2 ring-white/60"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${g1}, ${g2})`,
          fontSize: size * 0.34,
        }}
        aria-hidden
      >
        {initials(member.name)}
      </div>
    );
  }
  return (
    <img
      src={`${BASE}team/${member.photo}.jpg`}
      alt={member.name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-2xl object-cover shadow-sm ring-2 ring-white/60"
      style={{ width: size, height: size }}
    />
  );
}

/* Large, centred card for active members. */
function LeadCard({ member, i }: { member: Member; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.08, type: "spring", stiffness: 240, damping: 22 }}
      whileHover={{ y: -4 }}
      className="group relative flex flex-col items-center rounded-3xl border border-white/70 bg-white/70 p-6 text-center shadow-sm transition-shadow hover:shadow-xl"
    >
      <Avatar member={member} size={84} />
      <p className="mt-3 text-base font-semibold text-ink-900">{member.name}</p>
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
        {member.role}
      </p>
      {member.blurb && (
        <p className="mt-2 text-xs leading-relaxed text-ink-500">{member.blurb}</p>
      )}
      {member.linkedin && (
        <a
          href={member.linkedin}
          target="_blank"
          rel="noreferrer"
          aria-label={`${member.name} on LinkedIn`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#0a66c2] px-3 py-1.5 text-xs font-medium text-white transition hover:brightness-110"
        >
          <LinkedInIcon className="h-3.5 w-3.5" /> Connect
        </a>
      )}
    </motion.div>
  );
}

/* Compact card for former members / advisors. */
function FormerCard({ member, i }: { member: Member; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
      className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/40 p-3"
    >
      <Avatar member={member} size={48} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink-800">{member.name}</p>
        <p className="text-xs font-medium text-ink-500">{member.role}</p>
      </div>
    </motion.div>
  );
}

export function Team() {
  const active = TEAM.filter((m) => !m.alumni);
  const alumni = TEAM.filter((m) => m.alumni);
  return (
    <div>
      <div className="mb-6 text-center">
        <a
          href={MAKEATHON_LINK}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-200"
        >
          🏆 2nd place · A*STAR Makeathon 2022 ↗
        </a>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink-900">Team ARM</h2>
        <p className="mx-auto mt-1.5 max-w-xl text-sm text-ink-600">
          Trace grew out of a human-centred effort to help recurrent-UTI patients while
          curbing antibiotic resistance.{" "}
          <a
            href={LINKEDIN_ARTICLE}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800"
          >
            Read the story →
          </a>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {active.map((m, i) => (
          <LeadCard key={m.name} member={m} i={i} />
        ))}
      </div>

      {alumni.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              With gratitude to those who’ve since moved on
            </p>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alumni.map((m, i) => (
              <FormerCard key={m.name} member={m} i={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
