import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";

type Suggestion = {
  email: string;
  displayName: string;
  isTeam?: boolean;
};

type OrgMember = {
  userId?: string;
  email?: string;
  fullName?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  id?: string;
  /** Optional org members shown first (typing a name or address). */
  orgMembers?: OrgMember[];
  "data-testid"?: string;
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export function RecipientInput({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
  id,
  orgMembers,
  "data-testid": dataTestId,
}: Props) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Garde anti-réponse périmée : seul le dernier fetch peut écrire le state.
  const reqIdRef = useRef(0);

  const query = value.trim();

  const buildTeamMatches = useCallback(
    (q: string): Suggestion[] => {
      if (!orgMembers || orgMembers.length === 0) return [];
      const nq = q.toLowerCase();
      return orgMembers
        .filter((m) => m.email && m.email.includes("@"))
        .filter(
          (m) =>
            !nq ||
            (m.email || "").toLowerCase().includes(nq) ||
            (m.fullName || "").toLowerCase().includes(nq),
        )
        .slice(0, 4)
        .map((m) => ({
          email: m.email as string,
          displayName: m.fullName || (m.email as string),
          isTeam: true,
        }));
    },
    [orgMembers],
  );

  useEffect(() => {
    const q = query;
    // On ne propose rien si le champ contient déjà exactement une adresse choisie.
    if (q.length < 1 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const myReqId = ++reqIdRef.current;
    const team = buildTeamMatches(q);
    const h = setTimeout(async () => {
      setLoading(true);
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const r = await fetch(
          `${import.meta.env.BASE_URL}api/contacts/search?q=${encodeURIComponent(q)}&limit=8`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        const j = await r.json().catch(() => ({}));
        // Réponse périmée → on ignore.
        if (myReqId !== reqIdRef.current) return;
        const list = (j?.contacts || j?.results || j || []) as Array<{
          email: string;
          displayName?: string;
        }>;
        const teamEmails = new Set(team.map((s) => normalize(s.email)));
        const contacts: Suggestion[] = list
          .filter((x) => x && x.email && x.email.includes("@"))
          .filter((x) => !teamEmails.has(normalize(x.email)))
          .map((x) => ({ email: x.email, displayName: x.displayName || x.email }));
        const merged = [...team, ...contacts].slice(0, 8);
        setSuggestions(merged);
        setActiveIndex(0);
        setOpen(merged.length > 0);
      } catch {
        if (myReqId !== reqIdRef.current) return;
        setSuggestions(team);
        setActiveIndex(0);
        setOpen(team.length > 0);
      } finally {
        if (myReqId === reqIdRef.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(h);
  }, [query, buildTeamMatches]);

  const applySuggestion = (s: Suggestion) => {
    // Backend = un seul destinataire : on remplace le champ par l'adresse.
    onChange(s.email);
    setSuggestions([]);
    setOpen(false);
    // Empêche le useEffect de rouvrir une liste pour cette même valeur.
    reqIdRef.current++;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      const sel = suggestions[activeIndex];
      if (sel) {
        e.preventDefault();
        applySuggestion(sel);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onBlur={() => {
          blurTimerRef.current = setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder}
        className={className}
        autoFocus={autoFocus}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        data-testid={dataTestId}
      />
      {open && suggestions.length > 0 && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-md border border-[color:var(--color-popover-border)] bg-popover py-1 shadow-lg"
          onMouseDown={(e) => {
            // empêche le blur de fermer avant le clic
            e.preventDefault();
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
          }}
        >
          {suggestions.map((s, i) => (
            <button
              key={`${s.email}-${i}`}
              type="button"
              onClick={() => applySuggestion(s)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[12px] ${
                i === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "text-popover-foreground hover:bg-accent/60"
              }`}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{s.displayName}</span>
                {s.displayName !== s.email && (
                  <span className="truncate text-[11px] opacity-60">{s.email}</span>
                )}
              </span>
              {s.isTeam && (
                <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                  {t("inbox.teamBadge", "Équipe")}
                </span>
              )}
            </button>
          ))}
          {loading && (
            <div className="px-3 py-1 text-[11px] opacity-50">
              {t("common.loading", "Chargement…")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
