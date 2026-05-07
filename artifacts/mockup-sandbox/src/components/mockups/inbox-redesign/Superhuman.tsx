import {
  Inbox, Star, Send, FileText, Archive, Users, Search,
  ChevronDown, Sparkles, CheckCircle2, Clock, Reply,
  Forward, MoreHorizontal, Paperclip, Command,
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
  important?: boolean;
};

const IMPORTANT: Row[] = [
  { id: "1", from: "Camille Renard", initials: "CR", subject: "Relance contrat Q2 — signature manquante", preview: "Bonjour, je reviens vers vous concernant la signature du contrat. Nous attendons votre retour avant vendredi…", time: "9:42", unread: true, attach: true, selected: true, important: true },
  { id: "2", from: "Hugo Lefèvre", initials: "HL", subject: "Proposition commerciale — Atelier Nord", preview: "Suite à notre échange, voici la proposition révisée avec les nouveaux tarifs et les délais d'exécution.", time: "9:18", unread: true, attach: true, important: true },
  { id: "3", from: "Sarah Petit", initials: "SP", subject: "Question sur la facturation TVA", preview: "Pourriez-vous m'éclairer sur la TVA applicable pour les prestations à l'étranger ?", time: "Hier", important: true },
];

const OTHER: Row[] = [
  { id: "4", from: "Stripe", initials: "S", subject: "Votre facture de mai est disponible", preview: "Le récapitulatif mensuel de votre compte Stripe est prêt à être consulté.", time: "8:55" },
  { id: "5", from: "Léa Martin", initials: "LM", subject: "Re: Brief campagne — relecture", preview: "C'est validé de mon côté, vous pouvez lancer la production. Merci pour la réactivité.", time: "Hier" },
  { id: "6", from: "Notion", initials: "N", subject: "5 nouvelles activités sur votre espace", preview: "Voici un résumé de l'activité récente sur l'espace Équipe Marketing cette semaine.", time: "Hier" },
  { id: "7", from: "GitHub", initials: "G", subject: "Pull request #482 prête à être relue", preview: "Refactor: extract email normalization into shared lib.", time: "Lun." },
  { id: "8", from: "Marine Caron", initials: "MC", subject: "Demande de devis — refonte site", preview: "Bonjour, nous souhaiterions un devis pour la refonte de notre site corporate.", time: "Dim." },
];

const ACCENT = "#5e63ee"; // Superhuman signature electric
const ACCENT_SOFT = "rgba(94, 99, 238, 0.08)";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded border border-[#e5e7ec] bg-white text-[10.5px] font-medium text-[#6b7280] tabular-nums">
      {children}
    </span>
  );
}

function RowItem({ r }: { r: Row }) {
  return (
    <div
      className={`group relative h-[52px] pl-3 pr-4 flex items-center gap-3 cursor-pointer border-l-2 ${
        r.selected ? "border-[#5e63ee]" : "border-transparent"
      }`}
      style={{ background: r.selected ? ACCENT_SOFT : undefined }}
    >
      {/* Unread dot */}
      <div className="w-1.5 flex justify-center shrink-0">
        {r.unread && <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />}
      </div>

      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-[#eef0f3] text-[#3b4250] flex items-center justify-center text-[11px] font-medium shrink-0">
        {r.initials}
      </div>

      {/* Sender — fixed column for alignment, like Superhuman */}
      <div className="w-[120px] shrink-0">
        <span className={`text-[13px] truncate block ${r.unread ? "font-semibold text-[#0b0d10]" : "text-[#3b4250]"}`}>
          {r.from}
        </span>
      </div>

      {/* Subject + preview inline */}
      <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
        <span className={`text-[13px] truncate ${r.unread ? "font-semibold text-[#0b0d10]" : "text-[#3b4250]"}`}>
          {r.subject}
        </span>
        <span className="text-[13px] text-[#8a93a0] truncate">— {r.preview}</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0">
        {r.attach && <Paperclip className="w-3 h-3 text-[#8a93a0]" strokeWidth={1.75} />}
        <span className="text-[11.5px] tabular-nums text-[#8a93a0] w-10 text-right">{r.time}</span>
      </div>

      {/* Hover actions — Superhuman shows kbd hints on hover */}
      <div className="absolute right-3 hidden group-hover:flex items-center gap-1 bg-white/95 px-1.5 py-1 rounded border border-[#eceef1]">
        <span className="flex items-center gap-1 text-[11px] text-[#6b7280]"><Kbd>E</Kbd> Done</span>
        <span className="flex items-center gap-1 text-[11px] text-[#6b7280] ml-1.5"><Kbd>H</Kbd> Snooze</span>
      </div>
    </div>
  );
}

export function Superhuman() {
  const sel = IMPORTANT[0];

  return (
    <div className="min-h-screen w-full bg-[#fbfbfa] text-[#0b0d10] antialiased"
         style={{ fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <div className="flex h-screen w-full">
        {/* Narrow rail — Superhuman style */}
        <aside className="w-[56px] shrink-0 bg-[#f5f5f1] border-r border-[#eceae3] flex flex-col items-center py-3 gap-1">
          <div className="w-8 h-8 rounded-md flex items-center justify-center mb-2"
               style={{ background: ACCENT }}>
            <span className="text-[12px] font-semibold text-white">N</span>
          </div>
          {[
            { I: Inbox, active: true, k: "G I" },
            { I: Star, k: "G S" },
            { I: Clock, k: "G N" },
            { I: Send, k: "G T" },
            { I: FileText, k: "G D" },
            { I: Archive, k: "G E" },
            { I: Users, k: "G U" },
          ].map((it, i) => (
            <button key={i}
              className={`w-9 h-9 rounded-md flex items-center justify-center ${
                it.active ? "bg-white text-[#0b0d10] shadow-sm" : "text-[#6b7280] hover:bg-white/60"
              }`}>
              <it.I className="w-[17px] h-[17px]" strokeWidth={1.75} />
            </button>
          ))}
          <div className="mt-auto flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#eef0f3] text-[#3b4250] flex items-center justify-center text-[11px] font-medium">
              JD
            </div>
          </div>
        </aside>

        {/* List column */}
        <section className="w-[480px] shrink-0 border-r border-[#eceae3] flex flex-col bg-[#fbfbfa]">
          {/* Compact top — Superhuman minimal */}
          <div className="h-12 px-4 flex items-center gap-2">
            <h1 className="text-[14px] font-semibold text-[#0b0d10]">Réception</h1>
            <span className="text-[12px] text-[#8a93a0]">8 sur 234</span>
            <div className="ml-auto flex items-center gap-1">
              <button className="h-7 px-2 rounded-md text-[12px] text-[#6b7280] hover:bg-[#f0eee7] flex items-center gap-1">
                Tri intelligent <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Search / command bar */}
          <div className="px-3 pb-2">
            <div className="h-9 rounded-md border border-[#eceae3] bg-white flex items-center px-2.5">
              <Search className="w-3.5 h-3.5 text-[#8a93a0] mr-2" strokeWidth={1.75} />
              <input placeholder="Tapez une commande ou recherchez…"
                className="flex-1 bg-transparent outline-none text-[13px] text-[#0b0d10] placeholder:text-[#8a93a0]" />
              <Kbd>⌘</Kbd><span className="ml-0.5"><Kbd>K</Kbd></span>
            </div>
          </div>

          {/* List with Important / Other split */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-3 pb-1.5 flex items-center gap-2">
              <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-[#6b7280]">Important</span>
              <span className="text-[10.5px] text-[#a8aeb8] tabular-nums">3</span>
              <Sparkles className="w-3 h-3 ml-1" strokeWidth={2} style={{ color: ACCENT }} />
            </div>
            <div>{IMPORTANT.map((r) => <RowItem key={r.id} r={r} />)}</div>

            <div className="px-4 pt-5 pb-1.5 flex items-center gap-2">
              <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-[#6b7280]">Autres</span>
              <span className="text-[10.5px] text-[#a8aeb8] tabular-nums">5</span>
            </div>
            <div>{OTHER.map((r) => <RowItem key={r.id} r={r} />)}</div>

            {/* Inbox zero hint */}
            <div className="px-6 py-12 text-center">
              <CheckCircle2 className="w-6 h-6 mx-auto mb-2" style={{ color: ACCENT }} strokeWidth={1.5} />
              <div className="text-[12.5px] text-[#6b7280]">Vous avez tout traité aujourd'hui.</div>
            </div>
          </div>

          {/* Bottom shortcut bar — signature Superhuman */}
          <div className="h-9 px-3 border-t border-[#eceae3] flex items-center gap-3 bg-[#f5f5f1]">
            <span className="flex items-center gap-1 text-[11px] text-[#6b7280]"><Kbd>J</Kbd><Kbd>K</Kbd> Naviguer</span>
            <span className="flex items-center gap-1 text-[11px] text-[#6b7280]"><Kbd>E</Kbd> Done</span>
            <span className="flex items-center gap-1 text-[11px] text-[#6b7280]"><Kbd>R</Kbd> Répondre</span>
            <span className="flex items-center gap-1 text-[11px] text-[#6b7280] ml-auto"><Command className="w-3 h-3" /><Kbd>K</Kbd> Commandes</span>
          </div>
        </section>

        {/* Reading pane */}
        <section className="flex-1 min-w-0 bg-white flex flex-col">
          {/* Minimal toolbar — actions appear on hover/keyboard, not as buttons */}
          <div className="h-12 px-6 flex items-center gap-1 border-b border-[#f1f3f5]">
            <button className="h-7 px-2.5 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1.5">
              <Reply className="w-3.5 h-3.5" strokeWidth={1.75} /> Répondre <Kbd>R</Kbd>
            </button>
            <button className="h-7 px-2.5 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1.5">
              <Forward className="w-3.5 h-3.5" strokeWidth={1.75} /> Transférer <Kbd>F</Kbd>
            </button>
            <span className="mx-1 h-4 w-px bg-[#eceef1]" />
            <button className="h-7 px-2.5 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1.5">
              <Archive className="w-3.5 h-3.5" strokeWidth={1.75} /> Done <Kbd>E</Kbd>
            </button>
            <button className="h-7 px-2.5 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" strokeWidth={1.75} /> Snooze <Kbd>H</Kbd>
            </button>
            <button className="w-7 h-7 rounded-md flex items-center justify-center text-[#6b7280] hover:bg-[#f4f6f8]">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <div className="ml-auto">
              <button className="h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 text-white"
                      style={{ background: ACCENT }}>
                <Sparkles className="w-3.5 h-3.5" strokeWidth={2} /> Brouillon IA
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-10 py-7">
            <div className="max-w-[640px] mx-auto">
              <h2 className="text-[22px] font-semibold leading-snug tracking-[-0.01em] text-[#0b0d10]">
                {sel.subject}
              </h2>
              <div className="text-[12px] text-[#8a93a0] mt-1">
                Conversation · 3 messages · Atelier Nord
              </div>

              {/* Inboria summary — single accent, restrained */}
              <div className="mt-5 p-3.5 rounded-lg border-l-2 bg-[#fafafa]"
                   style={{ borderColor: ACCENT }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5" strokeWidth={2} style={{ color: ACCENT }} />
                  <span className="text-[11.5px] font-medium text-[#3b4250]">Résumé Inboria</span>
                </div>
                <p className="text-[12.5px] leading-relaxed text-[#3b4250]">
                  Camille relance pour la signature du contrat Q2. Pièce jointe incluse.
                  Réponse attendue avant vendredi. Suggérer un créneau de signature en visio.
                </p>
              </div>

              <div className="mt-7 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-[#eef0f3] text-[#3b4250] flex items-center justify-center text-[12px] font-medium">
                  {sel.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[14px] font-semibold text-[#0b0d10]">{sel.from}</span>
                    <span className="text-[12px] text-[#8a93a0]">camille@atelier-nord.fr</span>
                  </div>
                  <div className="text-[11.5px] text-[#8a93a0]">à moi · aujourd'hui à {sel.time}</div>
                </div>
              </div>

              <div className="mt-5 text-[14.5px] leading-[1.7] text-[#1f242c]">
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

              <div className="mt-6 flex items-center gap-2 p-2.5 rounded-md border border-[#eceef1] bg-[#fafafa] max-w-[360px]">
                <FileText className="w-4 h-4 text-[#8a93a0]" strokeWidth={1.75} />
                <span className="text-[12.5px] text-[#3b4250]">Contrat-Q2-Atelier-Nord.pdf</span>
                <span className="ml-auto text-[11px] text-[#8a93a0]">184 Ko</span>
              </div>

              {/* Reply composer hint — Superhuman style */}
              <div className="mt-8 border border-dashed border-[#dadde2] rounded-lg p-4 text-center">
                <div className="text-[12.5px] text-[#6b7280]">
                  Tapez <Kbd>R</Kbd> pour répondre, <Kbd>F</Kbd> pour transférer
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
