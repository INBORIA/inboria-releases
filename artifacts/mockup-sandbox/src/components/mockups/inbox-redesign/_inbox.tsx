import {
  Inbox, Send, FileText, Archive, Trash2, Users, Star, Tag,
  Search, Settings, Bell, ChevronDown, Sparkles, Plus,
  Paperclip, Reply, Forward, MoreHorizontal, CheckCircle2,
} from "lucide-react";

type Theme = "light" | "dark";

type Email = {
  id: string;
  from: string;
  initials: string;
  subject: string;
  preview: string;
  time: string;
  unread?: boolean;
  urgent?: boolean;
  hasAttachment?: boolean;
  category?: "Client" | "Interne" | "Prospect" | "Facturation";
  assignedTo?: string;
  hasFollowUp?: boolean;
  selected?: boolean;
};

const EMAILS: Email[] = [
  { id: "1", from: "Camille Renard", initials: "CR", subject: "Relance contrat Q2 — signature manquante", preview: "Bonjour, je reviens vers vous concernant la signature du contrat. Nous attendons votre retour…", time: "09:42", unread: true, urgent: true, hasAttachment: true, category: "Client", selected: true },
  { id: "2", from: "Hugo Lefèvre",   initials: "HL", subject: "Proposition commerciale — Atelier Nord", preview: "Suite à notre échange, voici la proposition révisée avec les nouveaux tarifs…", time: "09:18", unread: true, hasAttachment: true, category: "Prospect", assignedTo: "MD" },
  { id: "3", from: "Stripe",          initials: "S",  subject: "Votre facture de mai est disponible", preview: "Le récapitulatif mensuel de votre compte Stripe est prêt à être consulté.", time: "08:55", unread: true, category: "Facturation" },
  { id: "4", from: "Léa Martin",      initials: "LM", subject: "Re: Brief campagne — relecture", preview: "C'est validé de mon côté, vous pouvez lancer la production. Merci pour la réactivité.", time: "Hier", category: "Interne", hasFollowUp: true },
  { id: "5", from: "Notion",          initials: "N",  subject: "5 nouvelles activités sur votre espace", preview: "Voici un résumé de l'activité récente sur l'espace Équipe Marketing…", time: "Hier" },
  { id: "6", from: "Sarah Petit",     initials: "SP", subject: "Question sur la facturation TVA", preview: "Pourriez-vous m'éclairer sur la TVA applicable pour les prestations à l'étranger ?", time: "Hier", category: "Client", assignedTo: "JD" },
  { id: "7", from: "GitHub",          initials: "G",  subject: "Pull request #482 prête à être relue", preview: "Refactor: extract email normalization into shared lib.", time: "Lun." },
  { id: "8", from: "Antoine Dubois",  initials: "AD", subject: "Compte rendu réunion direction", preview: "Voici le compte rendu de la réunion de jeudi avec les actions à mener.", time: "Lun.", category: "Interne", hasAttachment: true },
  { id: "9", from: "Marine Caron",    initials: "MC", subject: "Demande de devis — refonte site", preview: "Bonjour, nous souhaiterions un devis pour la refonte de notre site corporate.", time: "Dim.", category: "Prospect" },
];

export function InboxMockup({ theme }: { theme: Theme }) {
  const isDark = theme === "dark";

  // Single accent: cyan. Used only on unread dot, primary CTAs, focused row.
  const t = isDark
    ? {
        page: "bg-[#0b0d10] text-[#e6e8eb]",
        sidebar: "bg-[#0b0d10] border-[#1a1d22]",
        toolbar: "bg-[#0b0d10]/95 border-[#1a1d22]",
        list: "bg-[#0b0d10] border-[#1a1d22]",
        preview: "bg-[#0e1115]",
        rowHover: "hover:bg-[#13171c]",
        rowSelected: "bg-[#13171c]",
        rowBorder: "border-[#15191e]",
        muted: "text-[#7a8290]",
        soft: "text-[#9aa3b1]",
        strong: "text-[#e6e8eb]",
        avatar: "bg-[#1a1d22] text-[#cfd5dd]",
        chip: "bg-[#13171c] text-[#9aa3b1] border-[#1a1d22]",
        accent: "text-cyan-400",
        accentDot: "bg-cyan-400",
        accentBtn: "bg-cyan-500 hover:bg-cyan-400 text-[#06121a]",
        ghostBtn: "hover:bg-[#13171c] text-[#9aa3b1]",
        searchBg: "bg-[#13171c] border-[#1a1d22] text-[#cfd5dd] placeholder:text-[#5a6270]",
        sidebarItem: "hover:bg-[#13171c] text-[#9aa3b1]",
        sidebarItemActive: "bg-[#13171c] text-[#e6e8eb]",
        urgentBar: "bg-cyan-400",
      }
    : {
        page: "bg-[#fafbfc] text-[#0b0d10]",
        sidebar: "bg-white border-[#eceef1]",
        toolbar: "bg-white/95 border-[#eceef1]",
        list: "bg-white border-[#eceef1]",
        preview: "bg-white",
        rowHover: "hover:bg-[#f6f7f9]",
        rowSelected: "bg-[#f4f6f8]",
        rowBorder: "border-[#f1f3f5]",
        muted: "text-[#8a93a0]",
        soft: "text-[#5b6573]",
        strong: "text-[#0b0d10]",
        avatar: "bg-[#eef0f3] text-[#3b4250]",
        chip: "bg-[#f4f6f8] text-[#5b6573] border-[#eceef1]",
        accent: "text-cyan-600",
        accentDot: "bg-cyan-500",
        accentBtn: "bg-cyan-600 hover:bg-cyan-500 text-white",
        ghostBtn: "hover:bg-[#f4f6f8] text-[#5b6573]",
        searchBg: "bg-[#f4f6f8] border-[#eceef1] text-[#0b0d10] placeholder:text-[#8a93a0]",
        sidebarItem: "hover:bg-[#f4f6f8] text-[#5b6573]",
        sidebarItemActive: "bg-[#f0f3f6] text-[#0b0d10]",
        urgentBar: "bg-cyan-500",
      };

  const selected = EMAILS.find((e) => e.selected) ?? EMAILS[0];

  return (
    <div className={`min-h-screen w-full font-sans antialiased ${t.page}`} style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div className="flex h-screen w-full">
        {/* Sidebar */}
        <aside className={`w-[232px] shrink-0 border-r ${t.sidebar} flex flex-col`}>
          <div className="h-14 px-4 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
              <span className="text-[11px] font-semibold text-[#06121a]">N</span>
            </div>
            <span className={`text-[14px] font-medium ${t.strong}`}>NCV Mail</span>
          </div>

          <div className="px-3 pb-2">
            <button className={`w-full h-9 rounded-md text-[13px] font-medium flex items-center justify-center gap-2 ${t.accentBtn}`}>
              <Plus className="w-4 h-4" /> Nouveau message
            </button>
          </div>

          <nav className="px-2 py-1 space-y-px text-[13px]">
            {[
              { icon: Inbox, label: "Réception", count: 12, active: true },
              { icon: Star, label: "À suivre", count: 3 },
              { icon: Send, label: "Envoyés" },
              { icon: FileText, label: "Brouillons", count: 2 },
              { icon: Archive, label: "Archives" },
              { icon: Trash2, label: "Corbeille" },
            ].map((it) => (
              <button key={it.label}
                className={`w-full h-8 px-2.5 rounded-md flex items-center gap-2.5 ${it.active ? t.sidebarItemActive : t.sidebarItem}`}>
                <it.icon className="w-[15px] h-[15px]" strokeWidth={1.75} />
                <span className="flex-1 text-left">{it.label}</span>
                {it.count != null && (
                  <span className={`text-[11px] tabular-nums ${it.active ? t.strong : t.muted}`}>{it.count}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="px-4 mt-4 mb-1.5">
            <div className={`text-[10px] uppercase tracking-[0.08em] ${t.muted}`}>Équipes</div>
          </div>
          <nav className="px-2 space-y-px text-[13px]">
            {[
              { label: "Commercial", count: 5 },
              { label: "Support", count: 1 },
              { label: "Direction" },
            ].map((it) => (
              <button key={it.label} className={`w-full h-8 px-2.5 rounded-md flex items-center gap-2.5 ${t.sidebarItem}`}>
                <Users className="w-[15px] h-[15px]" strokeWidth={1.75} />
                <span className="flex-1 text-left">{it.label}</span>
                {it.count != null && <span className={`text-[11px] tabular-nums ${t.muted}`}>{it.count}</span>}
              </button>
            ))}
          </nav>

          <div className="px-4 mt-4 mb-1.5">
            <div className={`text-[10px] uppercase tracking-[0.08em] ${t.muted}`}>Étiquettes</div>
          </div>
          <nav className="px-2 space-y-px text-[13px]">
            {[
              { label: "Client", color: "#3b82f6" },
              { label: "Prospect", color: "#a855f7" },
              { label: "Interne", color: "#94a3b8" },
              { label: "Facturation", color: "#f59e0b" },
            ].map((it) => (
              <button key={it.label} className={`w-full h-8 px-2.5 rounded-md flex items-center gap-2.5 ${t.sidebarItem}`}>
                <span className="w-2 h-2 rounded-full" style={{ background: it.color, opacity: 0.85 }} />
                <span className="flex-1 text-left">{it.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto px-3 pb-3">
            <div className={`flex items-center gap-2 h-10 px-2 rounded-md ${t.sidebarItem}`}>
              <div className={`w-7 h-7 rounded-full ${t.avatar} flex items-center justify-center text-[11px] font-medium`}>JD</div>
              <div className="flex-1 min-w-0">
                <div className={`text-[12.5px] truncate ${t.strong}`}>Julien Dupont</div>
                <div className={`text-[11px] truncate ${t.muted}`}>Plus · 2 boîtes</div>
              </div>
              <Settings className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>
        </aside>

        {/* List column */}
        <section className={`w-[420px] shrink-0 border-r ${t.list} flex flex-col`}>
          {/* Toolbar */}
          <div className={`h-14 px-4 flex items-center gap-2 border-b ${t.toolbar}`}>
            <h1 className={`text-[15px] font-semibold ${t.strong}`}>Réception</h1>
            <span className={`text-[12px] ${t.muted}`}>· 12 non lus</span>
            <div className="ml-auto flex items-center gap-1">
              <button className={`h-8 px-2.5 rounded-md text-[12.5px] flex items-center gap-1.5 ${t.ghostBtn}`}>
                Tri intelligent <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button className={`w-8 h-8 rounded-md flex items-center justify-center ${t.ghostBtn}`}>
                <Bell className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 pt-3 pb-2">
            <div className={`relative h-9 rounded-md border ${t.searchBg} flex items-center px-2.5`}>
              <Search className="w-4 h-4 mr-2 opacity-70" strokeWidth={1.75} />
              <input
                placeholder="Rechercher dans la réception"
                className={`flex-1 bg-transparent outline-none text-[13px] ${isDark ? "text-[#cfd5dd]" : "text-[#0b0d10]"}`}
                defaultValue=""
              />
              <span className={`text-[10.5px] px-1.5 py-0.5 rounded border ${t.chip}`}>⌘K</span>
            </div>
          </div>

          {/* Category tabs */}
          <div className="px-3 pb-2 flex items-center gap-1">
            {[
              { label: "Tous", active: true, count: 38 },
              { label: "Non lus", count: 12 },
              { label: "À répondre", count: 4 },
              { label: "Mentions", count: 1 },
            ].map((tab) => (
              <button key={tab.label}
                className={`h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 ${
                  tab.active ? `${t.sidebarItemActive} ${t.strong}` : t.ghostBtn
                }`}>
                {tab.label}
                <span className={`text-[10.5px] tabular-nums ${tab.active ? t.soft : t.muted}`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* List */}
          <ul className="flex-1 overflow-y-auto">
            {EMAILS.map((e) => (
              <li key={e.id}
                className={`relative h-[68px] pl-4 pr-3 border-b ${t.rowBorder} flex items-center gap-3 cursor-pointer ${
                  e.selected ? t.rowSelected : t.rowHover
                }`}>
                {/* Urgent bar — single accent, only on urgent + unread */}
                {e.urgent && (
                  <span className={`absolute left-0 top-2 bottom-2 w-[2px] rounded-r ${t.urgentBar}`} />
                )}

                {/* Unread dot */}
                <div className="w-2 flex justify-center">
                  {e.unread ? (
                    <span className={`w-1.5 h-1.5 rounded-full ${t.accentDot}`} />
                  ) : (
                    <span className="w-1.5 h-1.5" />
                  )}
                </div>

                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full ${t.avatar} flex items-center justify-center text-[12px] font-medium shrink-0`}>
                  {e.initials}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[13.5px] truncate ${e.unread ? `font-semibold ${t.strong}` : t.soft}`}>
                      {e.from}
                    </span>
                    <span className={`ml-auto text-[11.5px] tabular-nums shrink-0 ${e.unread ? t.soft : t.muted}`}>
                      {e.time}
                    </span>
                  </div>
                  <div className={`text-[13px] truncate ${e.unread ? t.strong : t.soft}`}>{e.subject}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[11.5px] truncate flex-1 ${t.muted}`}>{e.preview}</span>
                    {e.hasAttachment && <Paperclip className={`w-3 h-3 shrink-0 ${t.muted}`} strokeWidth={1.75} />}
                    {e.assignedTo && (
                      <span className={`text-[10px] px-1.5 py-[1px] rounded ${t.chip} border tabular-nums`}>
                        →{e.assignedTo}
                      </span>
                    )}
                    {e.hasFollowUp && <CheckCircle2 className={`w-3 h-3 shrink-0 ${t.muted}`} strokeWidth={1.75} />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Reading pane */}
        <section className={`flex-1 min-w-0 ${t.preview} flex flex-col`}>
          {/* Header */}
          <div className={`h-14 px-5 flex items-center gap-2 border-b ${t.rowBorder}`}>
            <button className={`h-8 px-3 rounded-md text-[12.5px] flex items-center gap-1.5 ${t.ghostBtn}`}>
              <Reply className="w-3.5 h-3.5" strokeWidth={1.75} /> Répondre
            </button>
            <button className={`h-8 px-3 rounded-md text-[12.5px] flex items-center gap-1.5 ${t.ghostBtn}`}>
              <Forward className="w-3.5 h-3.5" strokeWidth={1.75} /> Transférer
            </button>
            <span className={`mx-1 h-4 w-px ${isDark ? "bg-[#1a1d22]" : "bg-[#eceef1]"}`} />
            <button className={`h-8 px-3 rounded-md text-[12.5px] flex items-center gap-1.5 ${t.ghostBtn}`}>
              <Archive className="w-3.5 h-3.5" strokeWidth={1.75} /> Archiver
            </button>
            <button className={`w-8 h-8 rounded-md flex items-center justify-center ${t.ghostBtn}`}>
              <MoreHorizontal className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <div className="ml-auto flex items-center gap-1">
              <button className={`h-8 px-3 rounded-md text-[12.5px] flex items-center gap-1.5 ${t.accentBtn}`}>
                <Sparkles className="w-3.5 h-3.5" strokeWidth={2} /> Brouillon IA
              </button>
            </div>
          </div>

          {/* Email */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="max-w-[640px] mx-auto">
              <h2 className={`text-[20px] font-semibold leading-snug ${t.strong}`}>{selected.subject}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border ${t.chip}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#3b82f6" }} /> Client
                </span>
                <span className={`text-[11.5px] ${t.muted}`}>·</span>
                <span className={`text-[11.5px] ${t.muted}`}>Conversation · 3 messages</span>
              </div>

              {/* AI summary */}
              <div className={`mt-5 p-3.5 rounded-lg border ${isDark ? "border-[#1a1d22] bg-[#0e1115]" : "border-[#eceef1] bg-[#f9fafb]"}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className={`w-3.5 h-3.5 ${t.accent}`} strokeWidth={2} />
                  <span className={`text-[11.5px] font-medium ${t.soft}`}>Résumé Inboria</span>
                </div>
                <p className={`text-[12.5px] leading-relaxed ${t.soft}`}>
                  Camille relance pour la signature du contrat Q2. Pièce jointe incluse.
                  Réponse attendue avant fin de semaine. Suggérer un créneau de signature en visio.
                </p>
              </div>

              {/* Sender */}
              <div className="mt-6 flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full ${t.avatar} flex items-center justify-center text-[13px] font-medium`}>
                  {selected.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[14px] font-semibold ${t.strong}`}>{selected.from}</span>
                    <span className={`text-[12px] ${t.muted}`}>camille@atelier-nord.fr</span>
                  </div>
                  <div className={`text-[11.5px] ${t.muted}`}>à moi · aujourd'hui à {selected.time}</div>
                </div>
              </div>

              <div className={`mt-4 text-[14px] leading-[1.7] ${t.soft}`}>
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

              {/* Attachments */}
              <div className={`mt-5 flex items-center gap-2 p-2.5 rounded-md border ${t.chip}`}>
                <FileText className={`w-4 h-4 ${t.muted}`} strokeWidth={1.75} />
                <span className={`text-[12.5px] ${t.soft}`}>Contrat-Q2-Atelier-Nord.pdf</span>
                <span className={`ml-auto text-[11px] ${t.muted}`}>184 Ko</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
