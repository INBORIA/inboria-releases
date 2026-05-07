import { useState } from "react";
import {
  Inbox, Star, Send, FileText, Archive, Users, Search, Trash2,
  ChevronDown, ChevronRight, Sparkles, CheckCircle2, Clock, Reply,
  Forward, Paperclip, Command, Bell, Maximize2,
  Tag, UserPlus, Brain, Building2, Mail,
  TrendingUp, Phone, Calendar, Plus, Settings, Filter, ReplyAll,
  Printer, ShieldAlert, FolderInput, X,
} from "lucide-react";

type Row = {
  id: string;
  from: string;
  initials: string;
  subject: string;
  preview: string;
  time: string;
  unread?: boolean;
  attach?: boolean;
  selected?: boolean;
  category?: string;
  assignedTo?: string;
};

const IMPORTANT: Row[] = [
  { id: "1", from: "Camille Renard", initials: "CR", subject: "Relance contrat Q2 — signature manquante", preview: "Bonjour, je reviens vers vous concernant la signature du contrat. Nous attendons votre retour avant vendredi…", time: "9:42", unread: true, attach: true, selected: true, category: "client" },
  { id: "2", from: "Hugo Lefèvre", initials: "HL", subject: "Proposition commerciale — Atelier Nord", preview: "Suite à notre échange, voici la proposition révisée avec les nouveaux tarifs et les délais d'exécution.", time: "9:18", unread: true, attach: true, category: "prospect", assignedTo: "MD" },
  { id: "3", from: "Sarah Petit", initials: "SP", subject: "Question sur la facturation TVA", preview: "Pourriez-vous m'éclairer sur la TVA applicable pour les prestations à l'étranger ?", time: "Hier", category: "client" },
];

const OTHER: Row[] = [
  { id: "4", from: "Stripe", initials: "S", subject: "Votre facture de mai est disponible", preview: "Le récapitulatif mensuel de votre compte Stripe est prêt à être consulté.", time: "8:55", category: "facturation" },
  { id: "5", from: "Léa Martin", initials: "LM", subject: "Re: Brief campagne — relecture", preview: "C'est validé de mon côté, vous pouvez lancer la production. Merci pour la réactivité.", time: "Hier", category: "interne" },
  { id: "6", from: "Notion", initials: "N", subject: "5 nouvelles activités sur votre espace", preview: "Voici un résumé de l'activité récente sur l'espace Équipe Marketing cette semaine.", time: "Hier" },
  { id: "7", from: "GitHub", initials: "G", subject: "Pull request #482 prête à être relue", preview: "Refactor: extract email normalization into shared lib.", time: "Lun." },
  { id: "8", from: "Marine Caron", initials: "MC", subject: "Demande de devis — refonte site", preview: "Bonjour, nous souhaiterions un devis pour la refonte de notre site corporate.", time: "Dim.", category: "prospect" },
];

const ACCENT = "#4F46E5";
const ACCENT_SOFT = "rgba(79, 70, 229, 0.10)";
const ACCENT_SELECT = "rgba(79, 70, 229, 0.12)";

// Dark palette
const BG = "#0b0d10";
const RAIL = "#06080a";
const LIST = "#11151b";
const READ = "#161b22";
const TEXT = "#e6e9ef";
const TEXT2 = "#8b95a7";
const SEP = "#1f2630";
const HOVER = "#1a2030";
const KBD_BG = "#1f2630";
const KBD_BORDER = "#2a3340";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded text-[10.5px] font-medium tabular-nums"
      style={{ background: KBD_BG, border: `1px solid ${KBD_BORDER}`, color: TEXT2 }}
    >
      {children}
    </span>
  );
}

function HoverAction({ icon: Icon, label, k }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string; k: string }) {
  return (
    <button
      className="flex items-center gap-1 h-6 px-1.5 rounded"
      style={{ color: TEXT }}
      title={`${label} (${k})`}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
      <Kbd>{k}</Kbd>
    </button>
  );
}

function RowItem({ r, onCategoryClick }: { r: Row; onCategoryClick?: (c: string) => void }) {
  return (
    <div
      className="group relative h-[52px] pl-3 pr-3 flex items-center gap-3 cursor-pointer border-l-2"
      style={{
        borderColor: r.selected ? ACCENT : "transparent",
        background: r.selected ? ACCENT_SELECT : undefined,
      }}
      onMouseEnter={(e) => { if (!r.selected) (e.currentTarget as HTMLDivElement).style.background = HOVER; }}
      onMouseLeave={(e) => { if (!r.selected) (e.currentTarget as HTMLDivElement).style.background = ""; }}
    >
      <div className="w-1.5 flex justify-center shrink-0">
        {r.unread && <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />}
      </div>

      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0"
        style={{ background: "#222a35", color: TEXT }}
      >
        {r.initials}
      </div>

      <div className="w-[120px] shrink-0 flex items-center gap-1.5">
        <span
          className="text-[13px] truncate"
          style={{ color: r.unread ? TEXT : "#c2c8d4", fontWeight: r.unread ? 600 : 400 }}
        >
          {r.from}
        </span>
        {r.assignedTo && (
          <span className="text-[10px] tabular-nums shrink-0" style={{ color: TEXT2 }}>→{r.assignedTo}</span>
        )}
      </div>

      <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
        <span
          className="text-[13px] truncate"
          style={{ color: r.unread ? TEXT : "#c2c8d4", fontWeight: r.unread ? 600 : 400 }}
        >
          {r.subject}
        </span>
        <span className="text-[13px] truncate" style={{ color: TEXT2 }}>— {r.preview}</span>
        {r.category && (
          <button
            className="text-[11px] lowercase shrink-0 hover:underline"
            style={{ color: "#6b7280" }}
            title={`Filtrer ${r.category}`}
            onClick={(e) => {
              e.stopPropagation();
              if (r.category) onCategoryClick?.(r.category);
            }}
          >
            {r.category}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 group-hover:hidden">
        {r.attach && <Paperclip className="w-3 h-3" style={{ color: TEXT2 }} strokeWidth={1.75} />}
        <span className="text-[11.5px] tabular-nums w-10 text-right" style={{ color: TEXT2 }}>{r.time}</span>
      </div>

      {/* Hover: ALL row actions kept, just hidden until hover */}
      <div
        className="hidden group-hover:flex items-center gap-0.5 shrink-0 px-1 rounded"
        style={{ background: "rgba(11,13,16,0.92)", border: `1px solid ${SEP}` }}
      >
        <HoverAction icon={Archive} label="Done" k="E" />
        <HoverAction icon={Clock} label="Snooze" k="H" />
        <HoverAction icon={Tag} label="Étiqueter" k="L" />
        <HoverAction icon={UserPlus} label="Assigner" k="A" />
        <HoverAction icon={Trash2} label="Supprimer" k="#" />
      </div>
    </div>
  );
}

export function SuperhumanDark() {
  const sel = IMPORTANT[0];
  const [crmOpen, setCrmOpen] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  const PLURAL: Record<string, string> = {
    client: "clients",
    prospect: "prospects",
    facturation: "facturation",
    interne: "interne",
  };
  const handleCategoryClick = (c: string) => setFilter(PLURAL[c] ?? c);

  return (
    <div
      className="min-h-screen w-full antialiased relative"
      style={{
        background: BG,
        color: TEXT,
        fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      <div className="flex h-screen w-full">
        {/* Rail gauche */}
        <aside
          className="w-[56px] shrink-0 flex flex-col items-center py-3 gap-1"
          style={{ background: RAIL, borderRight: `1px solid ${SEP}` }}
        >
          {/* Logo placeholder neutre — sera remplacé par le monogramme transparent (#245) */}
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center mb-2 text-white text-[15px] font-semibold"
            style={{ background: ACCENT }}
            title="NCV Mail"
          >
            N
          </div>
          {[
            { I: Plus, k: "C", primary: true, title: "Nouveau message" },
            { I: Inbox, active: true, k: "G I", title: "Réception" },
            { I: Star, k: "G S", title: "À suivre" },
            { I: Clock, k: "G N", title: "Snoozed" },
            { I: Send, k: "G T", title: "Envoyés" },
            { I: FileText, k: "G D", title: "Brouillons" },
            { I: Archive, k: "G E", title: "Archives" },
            { I: Trash2, k: "G !", title: "Corbeille" },
            { I: Users, k: "G U", title: "Équipes" },
            { I: Tag, k: "G L", title: "Étiquettes" },
          ].map((it, i) => (
            <button
              key={i}
              title={`${it.title} (${it.k})`}
              className="w-9 h-9 rounded-md flex items-center justify-center"
              style={
                it.primary
                  ? { background: ACCENT, color: "#fff" }
                  : it.active
                  ? { background: "#1a2030", color: TEXT }
                  : { color: TEXT2 }
              }
            >
              <it.I className="w-[17px] h-[17px]" strokeWidth={1.75} />
            </button>
          ))}
          <div className="mt-auto flex flex-col items-center gap-2">
            <button className="w-9 h-9 rounded-md flex items-center justify-center" style={{ color: TEXT2 }} title="Notifications">
              <Bell className="w-[17px] h-[17px]" strokeWidth={1.75} />
            </button>
            <button className="w-9 h-9 rounded-md flex items-center justify-center" style={{ color: TEXT2 }} title="Paramètres">
              <Settings className="w-[17px] h-[17px]" strokeWidth={1.75} />
            </button>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium"
              style={{ background: "#222a35", color: TEXT }}
              title="Julien Dupont"
            >
              JD
            </div>
          </div>
        </aside>

        {/* Liste */}
        <section
          className="w-[460px] shrink-0 flex flex-col"
          style={{ background: LIST, borderRight: `1px solid ${SEP}` }}
        >
          <div className="h-12 px-4 flex items-center gap-2">
            <h1 className="text-[14px] font-semibold" style={{ color: TEXT }}>Réception</h1>
            <span className="text-[12px]" style={{ color: TEXT2 }}>8 sur 234</span>
            <div className="ml-auto flex items-center gap-0.5">
              <button
                className="h-7 px-2 rounded-md text-[12px] flex items-center gap-1"
                style={{ color: TEXT2 }}
                title="Tri intelligent"
              >
                Tri intelligent <ChevronDown className="w-3 h-3" />
              </button>
              <button className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: TEXT2 }} title="Filtres (F)">
                <Filter className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
              <button className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: TEXT2 }} title="Plein écran">
                <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          <div className="px-3 pb-2">
            <div
              className="h-9 rounded-md flex items-center px-2.5"
              style={{ background: "#0d1218", border: `1px solid ${SEP}` }}
            >
              <Search className="w-3.5 h-3.5 mr-2" style={{ color: TEXT2 }} strokeWidth={1.75} />
              <input
                placeholder="Tapez une commande ou recherchez…"
                className="flex-1 bg-transparent outline-none text-[13px]"
                style={{ color: TEXT }}
              />
              <Kbd>⌘</Kbd><span className="ml-0.5"><Kbd>K</Kbd></span>
            </div>
          </div>

          {filter && (
            <div className="px-4 pb-1 text-[11px] flex items-center gap-1.5" style={{ color: TEXT2 }}>
              <span>Réception</span>
              <ChevronRight className="w-3 h-3" />
              <span style={{ color: TEXT }} className="lowercase">{filter} (12)</span>
              <button onClick={() => setFilter(null)} className="ml-1" title="Retirer le filtre">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-3 pb-1.5 flex items-center gap-2">
              <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold" style={{ color: TEXT2 }}>Important</span>
              <span className="text-[10.5px] tabular-nums" style={{ color: "#6b7480" }}>3</span>
              <Sparkles className="w-3 h-3 ml-1" strokeWidth={2} style={{ color: ACCENT }} />
            </div>
            <div>{IMPORTANT.map((r) => <RowItem key={r.id} r={r} onCategoryClick={handleCategoryClick} />)}</div>

            <div className="px-4 pt-5 pb-1.5 flex items-center gap-2">
              <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold" style={{ color: TEXT2 }}>Autres</span>
              <span className="text-[10.5px] tabular-nums" style={{ color: "#6b7480" }}>5</span>
            </div>
            <div>{OTHER.map((r) => <RowItem key={r.id} r={r} onCategoryClick={handleCategoryClick} />)}</div>

            <div className="px-6 py-12 text-center">
              <CheckCircle2 className="w-6 h-6 mx-auto mb-2" style={{ color: ACCENT }} strokeWidth={1.5} />
              <div className="text-[12.5px]" style={{ color: TEXT2 }}>Vous avez tout traité aujourd'hui.</div>
            </div>
          </div>

          <div
            className="h-9 px-3 flex items-center gap-3"
            style={{ background: RAIL, borderTop: `1px solid ${SEP}` }}
          >
            <span className="flex items-center gap-1 text-[11px]" style={{ color: TEXT2 }}><Kbd>J</Kbd><Kbd>K</Kbd> Naviguer</span>
            <span className="flex items-center gap-1 text-[11px]" style={{ color: TEXT2 }}><Kbd>E</Kbd> Done</span>
            <span className="flex items-center gap-1 text-[11px]" style={{ color: TEXT2 }}><Kbd>R</Kbd> Répondre</span>
            <span className="flex items-center gap-1 text-[11px] ml-auto" style={{ color: TEXT2 }}><Command className="w-3 h-3" /><Kbd>K</Kbd> Commandes</span>
          </div>
        </section>

        {/* Volet de lecture */}
        <section className="flex-1 min-w-0 flex flex-col" style={{ background: READ }}>
          {/* Toolbar : TOUS les boutons visibles, aucun caché */}
          <div
            className="px-4 py-2 flex flex-wrap items-center gap-y-1 gap-x-0.5"
            style={{ borderBottom: `1px solid ${SEP}` }}
          >
            {[
              { I: Reply, label: "Répondre", k: "R" },
              { I: ReplyAll, label: "Tous", k: "A" },
              { I: Forward, label: "Transférer", k: "F" },
            ].map((b, i) => (
              <button
                key={`g1-${i}`}
                className="h-7 px-2 rounded-md text-[12px] flex items-center gap-1 shrink-0"
                style={{ color: TEXT }}
              >
                <b.I className="w-3.5 h-3.5" strokeWidth={1.75} /> {b.label} <Kbd>{b.k}</Kbd>
              </button>
            ))}
            <span className="mx-1 h-4 w-px shrink-0" style={{ background: SEP }} />
            {[
              { I: Archive, label: "Done", k: "E" },
              { I: Clock, label: "Snooze", k: "H" },
              { I: Mail, label: "Non-lu", k: "U" },
              { I: Star, label: "Suivre", k: "S" },
            ].map((b, i) => (
              <button
                key={`g2-${i}`}
                className="h-7 px-2 rounded-md text-[12px] flex items-center gap-1 shrink-0"
                style={{ color: TEXT }}
              >
                <b.I className="w-3.5 h-3.5" strokeWidth={1.75} /> {b.label} <Kbd>{b.k}</Kbd>
              </button>
            ))}
            <span className="mx-1 h-4 w-px shrink-0" style={{ background: SEP }} />
            {[
              { I: Tag, label: "Étiquette", k: "L" },
              { I: UserPlus, label: "Assigner", k: ";" },
              { I: FolderInput, label: "Déplacer", k: "V" },
            ].map((b, i) => (
              <button
                key={`g3-${i}`}
                className="h-7 px-2 rounded-md text-[12px] flex items-center gap-1 shrink-0"
                style={{ color: TEXT }}
              >
                <b.I className="w-3.5 h-3.5" strokeWidth={1.75} /> {b.label} <Kbd>{b.k}</Kbd>
              </button>
            ))}
            <span className="mx-1 h-4 w-px shrink-0" style={{ background: SEP }} />
            <button className="h-7 px-2 rounded-md text-[12px] flex items-center gap-1 shrink-0" style={{ color: TEXT }}>
              <Printer className="w-3.5 h-3.5" strokeWidth={1.75} /> Imprimer
            </button>
            <button className="h-7 px-2 rounded-md text-[12px] flex items-center gap-1 shrink-0" style={{ color: TEXT }}>
              <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.75} /> Spam
            </button>
            <button className="h-7 px-2 rounded-md text-[12px] flex items-center gap-1 shrink-0" style={{ color: "#f08a8a" }}>
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} /> Suppr <Kbd>#</Kbd>
            </button>
            <span className="ml-auto shrink-0">
              <button
                className="h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 text-white"
                style={{ background: ACCENT }}
                title="Brouillon IA (D)"
              >
                <Sparkles className="w-3.5 h-3.5" strokeWidth={2} /> Brouillon IA <Kbd>D</Kbd>
              </button>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="max-w-[640px] mx-auto">
              <h2 className="text-[22px] font-semibold leading-snug tracking-[-0.01em]" style={{ color: TEXT }}>
                {sel.subject}
              </h2>
              <div className="text-[12px] mt-1 flex items-center gap-2" style={{ color: TEXT2 }}>
                <button onClick={() => setFilter("clients")} className="lowercase hover:underline">client</button>
                <span>·</span>
                <span>Conversation · 3 messages</span>
                <span>·</span>
                <span>Atelier Nord</span>
              </div>

              <div
                className="mt-5 p-3.5 rounded-lg border-l-2"
                style={{ borderColor: ACCENT, background: ACCENT_SOFT }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5" strokeWidth={2} style={{ color: ACCENT }} />
                  <span className="text-[11.5px] font-medium" style={{ color: TEXT }}>Résumé Inboria</span>
                </div>
                <p className="text-[12.5px] leading-relaxed" style={{ color: "#c2c8d4" }}>
                  Camille relance pour la signature du contrat Q2. Pièce jointe incluse.
                  Réponse attendue avant vendredi. Suggérer un créneau de signature en visio.
                </p>
              </div>

              <div className="mt-7 flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-medium"
                  style={{ background: "#222a35", color: TEXT }}
                >
                  {sel.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[14px] font-semibold" style={{ color: TEXT }}>{sel.from}</span>
                    <span className="text-[12px]" style={{ color: TEXT2 }}>camille@atelier-nord.fr</span>
                  </div>
                  <div className="text-[11.5px]" style={{ color: TEXT2 }}>à moi · aujourd'hui à {sel.time}</div>
                </div>
              </div>

              <div className="mt-5 text-[14.5px] leading-[1.7]" style={{ color: "#d2d7e0" }}>
                <p>Bonjour Julien,</p>
                <p className="mt-3">
                  Je reviens vers vous concernant la signature du contrat Q2. Nous attendons
                  votre retour pour pouvoir engager la production sur les délais initialement
                  prévus.
                </p>
                <p className="mt-3">
                  Vous trouverez en pièce jointe la version finalisée intégrant les ajustements
                  discutés lors de notre échange de mardi. Pourriez-vous me confirmer la
                  réception et envisager une signature avant vendredi ?
                </p>
                <p className="mt-3">Bien cordialement,</p>
                <p className="mt-1">Camille Renard — Atelier Nord</p>
              </div>

              <div
                className="mt-6 flex items-center gap-2 p-2.5 rounded-md max-w-[360px]"
                style={{ background: "#11161d", border: `1px solid ${SEP}` }}
              >
                <FileText className="w-4 h-4" style={{ color: TEXT2 }} strokeWidth={1.75} />
                <span className="text-[12.5px]" style={{ color: TEXT }}>Contrat-Q2-Atelier-Nord.pdf</span>
                <span className="ml-auto text-[11px]" style={{ color: TEXT2 }}>184 Ko</span>
              </div>

              <div
                className="mt-8 rounded-lg p-4 text-center"
                style={{ border: `1px dashed ${SEP}` }}
              >
                <div className="text-[12.5px]" style={{ color: TEXT2 }}>
                  Tapez <Kbd>R</Kbd> pour répondre, <Kbd>F</Kbd> pour transférer
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Panneau CRM + Mémoire */}
        {crmOpen ? (
          <aside
            className="w-[300px] shrink-0 flex flex-col"
            style={{ background: LIST, borderLeft: `1px solid ${SEP}` }}
          >
            <div className="h-12 px-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${SEP}` }}>
              <button
                className="h-7 px-2 rounded-md text-[12px] font-medium flex items-center gap-1.5"
                style={{ color: TEXT, background: "#1a2030", border: `1px solid ${SEP}` }}
              >
                <Building2 className="w-3.5 h-3.5" strokeWidth={1.75} /> CRM
              </button>
              <button
                className="h-7 px-2 rounded-md text-[12px] flex items-center gap-1.5"
                style={{ color: TEXT2 }}
              >
                <Brain className="w-3.5 h-3.5" strokeWidth={1.75} /> Mémoire
              </button>
              <button
                onClick={() => setCrmOpen(false)}
                className="ml-auto w-7 h-7 rounded-md flex items-center justify-center"
                style={{ color: TEXT2 }}
                title="Fermer"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Contact card */}
              <div className="rounded-lg p-3" style={{ background: READ, border: `1px solid ${SEP}` }}>
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-medium"
                    style={{ background: "#222a35", color: TEXT }}
                  >CR</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: TEXT }}>Camille Renard</div>
                    <div className="text-[11.5px] truncate" style={{ color: TEXT2 }}>Directrice — Atelier Nord</div>
                    <div className="text-[11px] truncate mt-0.5" style={{ color: TEXT2 }}>camille@atelier-nord.fr</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2.5">
                  <button
                    className="flex-1 h-7 rounded-md text-[11.5px] flex items-center justify-center gap-1"
                    style={{ color: TEXT, border: `1px solid ${SEP}` }}
                  >
                    <Phone className="w-3 h-3" strokeWidth={1.75} /> Appeler
                  </button>
                  <button
                    className="flex-1 h-7 rounded-md text-[11.5px] flex items-center justify-center gap-1"
                    style={{ color: TEXT, border: `1px solid ${SEP}` }}
                  >
                    <Calendar className="w-3 h-3" strokeWidth={1.75} /> RDV
                  </button>
                </div>
              </div>

              {/* HubSpot block — pictogramme orange conservé sur fond sombre */}
              <div className="rounded-lg overflow-hidden" style={{ background: READ, border: `1px solid ${SEP}` }}>
                <button className="w-full h-9 px-3 flex items-center gap-2 text-left">
                  <span className="w-4 h-4 rounded text-white text-[9px] font-bold flex items-center justify-center" style={{ background: "#ff7a59" }}>H</span>
                  <span className="text-[12px] font-medium" style={{ color: TEXT }}>HubSpot</span>
                  <span className="ml-auto text-[10px]" style={{ color: TEXT2 }}>Lifecycle: Customer</span>
                  <ChevronDown className="w-3 h-3" style={{ color: TEXT2 }} />
                </button>
                <div className="px-3 pb-3 space-y-2" style={{ borderTop: `1px solid ${SEP}` }}>
                  <div className="pt-2 flex items-center gap-1">
                    <button className="h-6 px-2 rounded text-[11px]" style={{ color: TEXT, border: `1px solid ${SEP}` }}>Logguer email</button>
                    <button className="h-6 px-2 rounded text-[11px]" style={{ color: TEXT, border: `1px solid ${SEP}` }}>+ Deal</button>
                    <button className="h-6 px-2 rounded text-[11px]" style={{ color: TEXT, border: `1px solid ${SEP}` }}>+ Tâche</button>
                  </div>
                  <div className="text-[11px] flex items-center gap-1.5" style={{ color: TEXT2 }}>
                    <TrendingUp className="w-3 h-3" strokeWidth={1.75} style={{ color: ACCENT }} />
                    <span>1 deal ouvert · 24 K€</span>
                  </div>
                </div>
              </div>

              {/* Inboria signaux */}
              <div className="rounded-lg p-3" style={{ background: READ, border: `1px solid ${SEP}` }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Brain className="w-3.5 h-3.5" strokeWidth={1.75} style={{ color: ACCENT }} />
                  <span className="text-[12px] font-medium" style={{ color: TEXT }}>Signaux Inboria</span>
                </div>
                <ul className="space-y-1.5 text-[11.5px]" style={{ color: "#c2c8d4" }}>
                  <li className="flex items-start gap-1.5"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: TEXT2 }} /> Échange régulier (12 emails / 30j)</li>
                  <li className="flex items-start gap-1.5"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: TEXT2 }} /> Délai moyen de réponse : 4 h</li>
                  <li className="flex items-start gap-1.5"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: TEXT2 }} /> Sujets récurrents : contrat, signature</li>
                </ul>
              </div>

              {/* Pipedrive / Salesforce condensés */}
              <div className="rounded-lg" style={{ background: READ, border: `1px solid ${SEP}` }}>
                <button className="w-full h-9 px-3 flex items-center gap-2 text-left">
                  <span className="w-4 h-4 rounded bg-black text-white text-[9px] font-bold flex items-center justify-center">P</span>
                  <span className="text-[12px] font-medium" style={{ color: TEXT }}>Pipedrive</span>
                  <ChevronRight className="w-3 h-3 ml-auto" style={{ color: TEXT2 }} />
                </button>
              </div>
              <div className="rounded-lg" style={{ background: READ, border: `1px solid ${SEP}` }}>
                <button className="w-full h-9 px-3 flex items-center gap-2 text-left">
                  <span className="w-4 h-4 rounded text-white text-[9px] font-bold flex items-center justify-center" style={{ background: "#00a1e0" }}>S</span>
                  <span className="text-[12px] font-medium" style={{ color: TEXT }}>Salesforce</span>
                  <ChevronRight className="w-3 h-3 ml-auto" style={{ color: TEXT2 }} />
                </button>
              </div>
            </div>
          </aside>
        ) : (
          <button
            onClick={() => setCrmOpen(true)}
            className="w-8 shrink-0 flex flex-col items-center justify-center gap-2"
            style={{ background: LIST, borderLeft: `1px solid ${SEP}`, color: TEXT2 }}
            title="Ouvrir CRM (⌘.)"
          >
            <Building2 className="w-4 h-4" strokeWidth={1.75} />
            <span className="text-[10px] [writing-mode:vertical-rl] rotate-180">CRM · Mémoire</span>
          </button>
        )}
      </div>

      {/* 2 chats distincts en bas à droite */}
      <div className="absolute bottom-5 right-5 flex items-center gap-2">
        <button
          className="h-9 w-9 rounded-full flex items-center justify-center text-[14px] font-semibold"
          style={{ background: READ, border: `1px solid ${SEP}`, color: TEXT2 }}
          title="Aide & support app — comment utiliser NCV Mail"
        >
          ?
        </button>
        <button
          className="h-11 px-4 rounded-full shadow-lg flex items-center gap-2 text-white text-[13px] font-medium hover:scale-[1.02] transition-transform"
          style={{ background: ACCENT, boxShadow: "0 8px 24px rgba(79,70,229,0.45)" }}
          title="Inboria — votre assistant données (emails, contacts, projets, RDV)"
        >
          <Sparkles className="w-4 h-4" strokeWidth={2} />
          Demander à Inboria
        </button>
      </div>
    </div>
  );
}
