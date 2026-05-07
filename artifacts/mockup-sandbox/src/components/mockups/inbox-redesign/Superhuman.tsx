import { useState } from "react";
import {
  Inbox, Star, Send, FileText, Archive, Users, Search, Trash2,
  ChevronDown, ChevronRight, Sparkles, CheckCircle2, Clock, Reply,
  Forward, MoreHorizontal, Paperclip, Command, Bell, Maximize2,
  MessageSquare, Tag, UserPlus, Brain, Building2, Mail,
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
  category?: { label: string; color: string };
  assignedTo?: string;
};

const IMPORTANT: Row[] = [
  { id: "1", from: "Camille Renard", initials: "CR", subject: "Relance contrat Q2 — signature manquante", preview: "Bonjour, je reviens vers vous concernant la signature du contrat. Nous attendons votre retour avant vendredi…", time: "9:42", unread: true, attach: true, selected: true, category: { label: "Client", color: "#3b82f6" } },
  { id: "2", from: "Hugo Lefèvre", initials: "HL", subject: "Proposition commerciale — Atelier Nord", preview: "Suite à notre échange, voici la proposition révisée avec les nouveaux tarifs et les délais d'exécution.", time: "9:18", unread: true, attach: true, category: { label: "Prospect", color: "#a855f7" }, assignedTo: "MD" },
  { id: "3", from: "Sarah Petit", initials: "SP", subject: "Question sur la facturation TVA", preview: "Pourriez-vous m'éclairer sur la TVA applicable pour les prestations à l'étranger ?", time: "Hier", category: { label: "Client", color: "#3b82f6" } },
];

const OTHER: Row[] = [
  { id: "4", from: "Stripe", initials: "S", subject: "Votre facture de mai est disponible", preview: "Le récapitulatif mensuel de votre compte Stripe est prêt à être consulté.", time: "8:55", category: { label: "Facturation", color: "#f59e0b" } },
  { id: "5", from: "Léa Martin", initials: "LM", subject: "Re: Brief campagne — relecture", preview: "C'est validé de mon côté, vous pouvez lancer la production. Merci pour la réactivité.", time: "Hier", category: { label: "Interne", color: "#94a3b8" } },
  { id: "6", from: "Notion", initials: "N", subject: "5 nouvelles activités sur votre espace", preview: "Voici un résumé de l'activité récente sur l'espace Équipe Marketing cette semaine.", time: "Hier" },
  { id: "7", from: "GitHub", initials: "G", subject: "Pull request #482 prête à être relue", preview: "Refactor: extract email normalization into shared lib.", time: "Lun." },
  { id: "8", from: "Marine Caron", initials: "MC", subject: "Demande de devis — refonte site", preview: "Bonjour, nous souhaiterions un devis pour la refonte de notre site corporate.", time: "Dim.", category: { label: "Prospect", color: "#a855f7" } },
];

const ACCENT = "#5e63ee";
const ACCENT_SOFT = "rgba(94, 99, 238, 0.08)";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded border border-[#e5e7ec] bg-white text-[10.5px] font-medium text-[#6b7280] tabular-nums">
      {children}
    </span>
  );
}

function HoverAction({ icon: Icon, label, k }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string; k: string }) {
  return (
    <button className="flex items-center gap-1 h-6 px-1.5 rounded hover:bg-[#f0f0ec] text-[#3b4250]" title={`${label} (${k})`}>
      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
      <Kbd>{k}</Kbd>
    </button>
  );
}

function RowItem({ r }: { r: Row }) {
  return (
    <div
      className={`group relative h-[52px] pl-3 pr-3 flex items-center gap-3 cursor-pointer border-l-2 ${
        r.selected ? "border-[#5e63ee]" : "border-transparent"
      }`}
      style={{ background: r.selected ? ACCENT_SOFT : undefined }}
    >
      <div className="w-1.5 flex justify-center shrink-0">
        {r.unread && <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />}
      </div>

      <div className="w-7 h-7 rounded-full bg-[#eef0f3] text-[#3b4250] flex items-center justify-center text-[11px] font-medium shrink-0">
        {r.initials}
      </div>

      <div className="w-[120px] shrink-0 flex items-center gap-1.5">
        <span className={`text-[13px] truncate ${r.unread ? "font-semibold text-[#0b0d10]" : "text-[#3b4250]"}`}>
          {r.from}
        </span>
        {r.assignedTo && (
          <span className="text-[10px] text-[#8a93a0] tabular-nums shrink-0">→{r.assignedTo}</span>
        )}
      </div>

      <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
        {r.category && (
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.category.color, opacity: 0.7 }} title={r.category.label} />
        )}
        <span className={`text-[13px] truncate ${r.unread ? "font-semibold text-[#0b0d10]" : "text-[#3b4250]"}`}>
          {r.subject}
        </span>
        <span className="text-[13px] text-[#8a93a0] truncate">— {r.preview}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0 group-hover:hidden">
        {r.attach && <Paperclip className="w-3 h-3 text-[#8a93a0]" strokeWidth={1.75} />}
        <span className="text-[11.5px] tabular-nums text-[#8a93a0] w-10 text-right">{r.time}</span>
      </div>

      {/* Hover: ALL row actions kept, just hidden until hover */}
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 bg-white/95 px-1 rounded border border-[#eceae3]">
        <HoverAction icon={Archive} label="Done" k="E" />
        <HoverAction icon={Clock} label="Snooze" k="H" />
        <HoverAction icon={Tag} label="Étiqueter" k="L" />
        <HoverAction icon={UserPlus} label="Assigner" k="A" />
        <HoverAction icon={Trash2} label="Supprimer" k="#" />
      </div>
    </div>
  );
}

export function Superhuman() {
  const sel = IMPORTANT[0];
  const [crmOpen, setCrmOpen] = useState(true);

  return (
    <div className="min-h-screen w-full bg-[#fbfbfa] text-[#0b0d10] antialiased relative"
         style={{ fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <div className="flex h-screen w-full">
        {/* Rail gauche : navigation principale + équipes/étiquettes en menu déroulant */}
        <aside className="w-[56px] shrink-0 bg-[#f5f5f1] border-r border-[#eceae3] flex flex-col items-center py-3 gap-1">
          <div className="w-9 h-9 rounded-md flex items-center justify-center mb-2 p-1"
               style={{ background: "#0b0d10" }} title="NCV Mail">
            <img src={`${import.meta.env.BASE_URL}logo-ncv.png`} alt="NCV" className="w-full h-full object-contain" />
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
            <button key={i}
              title={`${it.title} (${it.k})`}
              className={`w-9 h-9 rounded-md flex items-center justify-center ${
                it.primary ? "text-white" :
                it.active ? "bg-white text-[#0b0d10] shadow-sm" : "text-[#6b7280] hover:bg-white/60"
              }`}
              style={it.primary ? { background: ACCENT } : undefined}>
              <it.I className="w-[17px] h-[17px]" strokeWidth={1.75} />
            </button>
          ))}
          <div className="mt-auto flex flex-col items-center gap-2">
            <button className="w-9 h-9 rounded-md flex items-center justify-center text-[#6b7280] hover:bg-white/60" title="Notifications">
              <Bell className="w-[17px] h-[17px]" strokeWidth={1.75} />
            </button>
            <button className="w-9 h-9 rounded-md flex items-center justify-center text-[#6b7280] hover:bg-white/60" title="Paramètres">
              <Settings className="w-[17px] h-[17px]" strokeWidth={1.75} />
            </button>
            <div className="w-8 h-8 rounded-full bg-[#eef0f3] text-[#3b4250] flex items-center justify-center text-[11px] font-medium" title="Julien Dupont">
              JD
            </div>
          </div>
        </aside>

        {/* Liste */}
        <section className="w-[460px] shrink-0 border-r border-[#eceae3] flex flex-col bg-[#fbfbfa]">
          <div className="h-12 px-4 flex items-center gap-2">
            <h1 className="text-[14px] font-semibold text-[#0b0d10]">Réception</h1>
            <span className="text-[12px] text-[#8a93a0]">8 sur 234</span>
            <div className="ml-auto flex items-center gap-0.5">
              <button className="h-7 px-2 rounded-md text-[12px] text-[#6b7280] hover:bg-[#f0eee7] flex items-center gap-1" title="Tri intelligent">
                Tri intelligent <ChevronDown className="w-3 h-3" />
              </button>
              <button className="w-7 h-7 rounded-md flex items-center justify-center text-[#6b7280] hover:bg-[#f0eee7]" title="Filtres (F)">
                <Filter className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
              <button className="w-7 h-7 rounded-md flex items-center justify-center text-[#6b7280] hover:bg-[#f0eee7]" title="Plein écran">
                <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          <div className="px-3 pb-2">
            <div className="h-9 rounded-md border border-[#eceae3] bg-white flex items-center px-2.5">
              <Search className="w-3.5 h-3.5 text-[#8a93a0] mr-2" strokeWidth={1.75} />
              <input placeholder="Tapez une commande ou recherchez…"
                className="flex-1 bg-transparent outline-none text-[13px] text-[#0b0d10] placeholder:text-[#8a93a0]" />
              <Kbd>⌘</Kbd><span className="ml-0.5"><Kbd>K</Kbd></span>
            </div>
          </div>

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

            <div className="px-6 py-12 text-center">
              <CheckCircle2 className="w-6 h-6 mx-auto mb-2" style={{ color: ACCENT }} strokeWidth={1.5} />
              <div className="text-[12.5px] text-[#6b7280]">Vous avez tout traité aujourd'hui.</div>
            </div>
          </div>

          <div className="h-9 px-3 border-t border-[#eceae3] flex items-center gap-3 bg-[#f5f5f1]">
            <span className="flex items-center gap-1 text-[11px] text-[#6b7280]"><Kbd>J</Kbd><Kbd>K</Kbd> Naviguer</span>
            <span className="flex items-center gap-1 text-[11px] text-[#6b7280]"><Kbd>E</Kbd> Done</span>
            <span className="flex items-center gap-1 text-[11px] text-[#6b7280]"><Kbd>R</Kbd> Répondre</span>
            <span className="flex items-center gap-1 text-[11px] text-[#6b7280] ml-auto"><Command className="w-3 h-3" /><Kbd>K</Kbd> Commandes</span>
          </div>
        </section>

        {/* Volet de lecture */}
        <section className="flex-1 min-w-0 bg-white flex flex-col">
          {/* Toolbar : TOUS les boutons visibles, aucun caché */}
          <div className="px-4 py-2 flex flex-wrap items-center gap-y-1 gap-x-0.5 border-b border-[#f1f3f5]">
            <button className="h-7 px-2 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1 shrink-0">
              <Reply className="w-3.5 h-3.5" strokeWidth={1.75} /> Répondre <Kbd>R</Kbd>
            </button>
            <button className="h-7 px-2 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1 shrink-0">
              <ReplyAll className="w-3.5 h-3.5" strokeWidth={1.75} /> Tous <Kbd>A</Kbd>
            </button>
            <button className="h-7 px-2 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1 shrink-0">
              <Forward className="w-3.5 h-3.5" strokeWidth={1.75} /> Transférer <Kbd>F</Kbd>
            </button>
            <span className="mx-1 h-4 w-px bg-[#eceef1] shrink-0" />
            <button className="h-7 px-2 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1 shrink-0">
              <Archive className="w-3.5 h-3.5" strokeWidth={1.75} /> Done <Kbd>E</Kbd>
            </button>
            <button className="h-7 px-2 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1 shrink-0">
              <Clock className="w-3.5 h-3.5" strokeWidth={1.75} /> Snooze <Kbd>H</Kbd>
            </button>
            <button className="h-7 px-2 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1 shrink-0">
              <Mail className="w-3.5 h-3.5" strokeWidth={1.75} /> Non-lu <Kbd>U</Kbd>
            </button>
            <button className="h-7 px-2 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1 shrink-0">
              <Star className="w-3.5 h-3.5" strokeWidth={1.75} /> Suivre <Kbd>S</Kbd>
            </button>
            <span className="mx-1 h-4 w-px bg-[#eceef1] shrink-0" />
            <button className="h-7 px-2 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1 shrink-0">
              <Tag className="w-3.5 h-3.5" strokeWidth={1.75} /> Étiquette <Kbd>L</Kbd>
            </button>
            <button className="h-7 px-2 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1 shrink-0">
              <UserPlus className="w-3.5 h-3.5" strokeWidth={1.75} /> Assigner <Kbd>;</Kbd>
            </button>
            <button className="h-7 px-2 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1 shrink-0">
              <FolderInput className="w-3.5 h-3.5" strokeWidth={1.75} /> Déplacer <Kbd>V</Kbd>
            </button>
            <span className="mx-1 h-4 w-px bg-[#eceef1] shrink-0" />
            <button className="h-7 px-2 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1 shrink-0">
              <Printer className="w-3.5 h-3.5" strokeWidth={1.75} /> Imprimer
            </button>
            <button className="h-7 px-2 rounded-md text-[12px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center gap-1 shrink-0">
              <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.75} /> Spam
            </button>
            <button className="h-7 px-2 rounded-md text-[12px] text-[#b04545] hover:bg-[#fcecec] flex items-center gap-1 shrink-0">
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} /> Suppr <Kbd>#</Kbd>
            </button>
            <span className="ml-auto shrink-0">
              <button className="h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 text-white"
                      style={{ background: ACCENT }} title="Brouillon IA (D)">
                <Sparkles className="w-3.5 h-3.5" strokeWidth={2} /> Brouillon IA <Kbd>D</Kbd>
              </button>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="max-w-[640px] mx-auto">
              <h2 className="text-[22px] font-semibold leading-snug tracking-[-0.01em] text-[#0b0d10]">
                {sel.subject}
              </h2>
              <div className="text-[12px] text-[#8a93a0] mt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#3b82f6", opacity: 0.7 }} />
                  Client
                </span>
                <span>·</span>
                <span>Conversation · 3 messages</span>
                <span>·</span>
                <span>Atelier Nord</span>
              </div>

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

              <div className="mt-8 border border-dashed border-[#dadde2] rounded-lg p-4 text-center">
                <div className="text-[12.5px] text-[#6b7280]">
                  Tapez <Kbd>R</Kbd> pour répondre, <Kbd>F</Kbd> pour transférer
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Panneau CRM + Mémoire — pliable, onglets */}
        {crmOpen ? (
          <aside className="w-[300px] shrink-0 border-l border-[#eceae3] bg-[#fbfbfa] flex flex-col">
            <div className="h-12 px-3 flex items-center gap-2 border-b border-[#eceae3]">
              <button className="h-7 px-2 rounded-md text-[12px] font-medium text-[#0b0d10] bg-white border border-[#eceae3] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" strokeWidth={1.75} /> CRM
              </button>
              <button className="h-7 px-2 rounded-md text-[12px] text-[#6b7280] hover:bg-[#f0eee7] flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" strokeWidth={1.75} /> Mémoire
              </button>
              <button onClick={() => setCrmOpen(false)} className="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-[#6b7280] hover:bg-[#f0eee7]" title="Fermer">
                <X className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Contact card */}
              <div className="bg-white border border-[#eceae3] rounded-lg p-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#eef0f3] text-[#3b4250] flex items-center justify-center text-[12px] font-medium">CR</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#0b0d10] truncate">Camille Renard</div>
                    <div className="text-[11.5px] text-[#8a93a0] truncate">Directrice — Atelier Nord</div>
                    <div className="text-[11px] text-[#8a93a0] truncate mt-0.5">camille@atelier-nord.fr</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2.5">
                  <button className="flex-1 h-7 rounded-md text-[11.5px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center justify-center gap-1 border border-[#eceae3]">
                    <Phone className="w-3 h-3" strokeWidth={1.75} /> Appeler
                  </button>
                  <button className="flex-1 h-7 rounded-md text-[11.5px] text-[#3b4250] hover:bg-[#f4f6f8] flex items-center justify-center gap-1 border border-[#eceae3]">
                    <Calendar className="w-3 h-3" strokeWidth={1.75} /> RDV
                  </button>
                </div>
              </div>

              {/* HubSpot block */}
              <div className="bg-white border border-[#eceae3] rounded-lg overflow-hidden">
                <button className="w-full h-9 px-3 flex items-center gap-2 text-left">
                  <span className="w-4 h-4 rounded bg-[#ff7a59] text-white text-[9px] font-bold flex items-center justify-center">H</span>
                  <span className="text-[12px] font-medium text-[#0b0d10]">HubSpot</span>
                  <span className="ml-auto text-[10px] text-[#8a93a0]">Lifecycle: Customer</span>
                  <ChevronDown className="w-3 h-3 text-[#8a93a0]" />
                </button>
                <div className="px-3 pb-3 space-y-2 border-t border-[#f1f3f5]">
                  <div className="pt-2 flex items-center gap-1">
                    <button className="h-6 px-2 rounded text-[11px] text-[#3b4250] hover:bg-[#f4f6f8] border border-[#eceae3]">Logguer email</button>
                    <button className="h-6 px-2 rounded text-[11px] text-[#3b4250] hover:bg-[#f4f6f8] border border-[#eceae3]">+ Deal</button>
                    <button className="h-6 px-2 rounded text-[11px] text-[#3b4250] hover:bg-[#f4f6f8] border border-[#eceae3]">+ Tâche</button>
                  </div>
                  <div className="text-[11px] text-[#6b7280] flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" strokeWidth={1.75} style={{ color: ACCENT }} />
                    <span>1 deal ouvert · 24 K€</span>
                  </div>
                </div>
              </div>

              {/* Inboria signaux */}
              <div className="bg-white border border-[#eceae3] rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Brain className="w-3.5 h-3.5" strokeWidth={1.75} style={{ color: ACCENT }} />
                  <span className="text-[12px] font-medium text-[#0b0d10]">Signaux Inboria</span>
                </div>
                <ul className="space-y-1.5 text-[11.5px] text-[#3b4250]">
                  <li className="flex items-start gap-1.5"><span className="w-1 h-1 rounded-full bg-[#8a93a0] mt-1.5 shrink-0" /> Échange régulier (12 emails / 30j)</li>
                  <li className="flex items-start gap-1.5"><span className="w-1 h-1 rounded-full bg-[#8a93a0] mt-1.5 shrink-0" /> Délai moyen de réponse : 4 h</li>
                  <li className="flex items-start gap-1.5"><span className="w-1 h-1 rounded-full bg-[#8a93a0] mt-1.5 shrink-0" /> Sujets récurrents : contrat, signature</li>
                </ul>
              </div>

              {/* Pipedrive / Salesforce condensés */}
              <div className="bg-white border border-[#eceae3] rounded-lg">
                <button className="w-full h-9 px-3 flex items-center gap-2 text-left">
                  <span className="w-4 h-4 rounded bg-[#000000] text-white text-[9px] font-bold flex items-center justify-center">P</span>
                  <span className="text-[12px] font-medium text-[#0b0d10]">Pipedrive</span>
                  <ChevronRight className="w-3 h-3 text-[#8a93a0] ml-auto" />
                </button>
              </div>
              <div className="bg-white border border-[#eceae3] rounded-lg">
                <button className="w-full h-9 px-3 flex items-center gap-2 text-left">
                  <span className="w-4 h-4 rounded bg-[#00a1e0] text-white text-[9px] font-bold flex items-center justify-center">S</span>
                  <span className="text-[12px] font-medium text-[#0b0d10]">Salesforce</span>
                  <ChevronRight className="w-3 h-3 text-[#8a93a0] ml-auto" />
                </button>
              </div>
            </div>
          </aside>
        ) : (
          <button onClick={() => setCrmOpen(true)}
            className="w-8 shrink-0 border-l border-[#eceae3] bg-[#fbfbfa] hover:bg-[#f0eee7] flex flex-col items-center justify-center gap-2"
            title="Ouvrir CRM (⌘.)">
            <Building2 className="w-4 h-4 text-[#6b7280]" strokeWidth={1.75} />
            <span className="text-[10px] text-[#8a93a0] [writing-mode:vertical-rl] rotate-180">CRM · Mémoire</span>
          </button>
        )}
      </div>

      {/* 2 chats distincts en bas à droite */}
      <div className="absolute bottom-5 right-5 flex items-center gap-2">
        <button
          className="h-9 w-9 rounded-full bg-white border border-[#eceae3] shadow-sm flex items-center justify-center text-[#6b7280] hover:bg-[#f4f6f8] text-[14px] font-semibold"
          title="Aide & support app — comment utiliser NCV Mail">
          ?
        </button>
        <button
          className="h-11 px-4 rounded-full shadow-lg flex items-center gap-2 text-white text-[13px] font-medium hover:scale-[1.02] transition-transform"
          style={{ background: ACCENT, boxShadow: "0 8px 24px rgba(94,99,238,0.35)" }}
          title="Inboria — votre assistant données (emails, contacts, projets, RDV)">
          <Sparkles className="w-4 h-4" strokeWidth={2} />
          Demander à Inboria
        </button>
      </div>
    </div>
  );
}
