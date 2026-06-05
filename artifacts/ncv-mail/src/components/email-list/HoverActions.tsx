import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Reply,
  Forward,
  ListTodo,
  UserPlus,
  Mail,
  MailOpen,
  Clock,
  Bell,
  CalendarDays,
  Archive,
  Folder,
  FolderKanban,
  Briefcase,
  Copy,
  Type as TypeIcon,
  Download,
  Printer,
  ShieldAlert,
  Trash2,
} from "lucide-react";

export type HoverActionsCb = {
  onOpen: () => void;
  onReply: () => void;
  onForward: () => void;
  onCreateTask: () => void;
  // Optionnel : ouvre le formulaire complet (titre + projet + Assigner à)
  // pour créer une tâche d'équipe. Le bouton n'apparaît que si fourni.
  onCreateAndAssignTask?: () => void;
  onToggleRead: () => void;
  onSnooze: (hours: number, label: string) => void;
  onArchive: () => void;
  onSetCategory: (categoryId: string, name: string) => void;
  onMove: (folderId: string, name: string) => void;
  onSetProject?: (projectId: string, name: string) => void;
  onCopySender: () => void;
  onCopySubject: () => void;
  onDownloadEml: () => void;
  onPrint: () => void;
  onBlockSender: () => void;
  onDelete: () => void;
  // Reportés uniquement — réveille l'email (sort de l'état snoozed) et
  // le renvoie en Réception immédiatement. Optionnel : seul Reportés
  // (showUnsnooze=true) affiche le bouton.
  onUnsnooze?: () => void;
};

// Barre d'actions au survol — extrait du composant inline historique de
// dashboard/index.tsx pour pouvoir être réutilisé tel quel sur Envoyés
// (parité 1:1 demandée par l'utilisateur). Ne modifie pas la sémantique
// d'origine : mêmes icônes, mêmes popovers, mêmes raccourcis.
function HoverActionsImpl({
  isUnread,
  categoryCounts,
  userFolders,
  userProjects,
  cb,
  showBlockSender = true,
  showUnsnooze = false,
}: {
  isUnread: boolean;
  categoryCounts: any[] | undefined;
  userFolders: any[] | undefined;
  userProjects?: any[] | undefined;
  cb: HoverActionsCb;
  showBlockSender?: boolean;
  showUnsnooze?: boolean;
}) {
  const { t } = useTranslation();
  const [openMenu, setOpenMenu] = useState<null | "snooze" | "category" | "move" | "project" | "more">(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenMenu(null); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  const btn = "p-1 rounded hover:bg-white/[0.08] text-[#8b95a7] hover:text-white";
  const stop = (e: React.MouseEvent | React.SyntheticEvent) => { e.stopPropagation(); };
  const stopMD = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); };
  const click = (h: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); setOpenMenu(null); h(); };
  const popoverItem = "w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left";
  const popover = "absolute right-0 top-full mt-1 z-[100] min-w-[200px] rounded-lg border border-[#1f2937] bg-[#141c2b] shadow-2xl py-1";

  return (
    <div ref={wrapRef} className="hidden group-hover:flex items-center gap-0 shrink-0 relative" onMouseDown={stopMD} onClick={stop}>
      {showUnsnooze && cb.onUnsnooze && (
        <button
          className="p-1 rounded hover:bg-primary/[0.12] text-primary/80 hover:text-primary"
          title={t("wave1.snoozeWake", "Réveiller maintenant")}
          onMouseDown={stopMD}
          onClick={click(cb.onUnsnooze)}
          data-testid="hover-unsnooze"
        >
          <Bell className="w-3.5 h-3.5" />
        </button>
      )}
      <button className={btn} title={t("inbox.openEmail")} onMouseDown={stopMD} onClick={click(cb.onOpen)}><ChevronRight className="w-3.5 h-3.5" /></button>
      <button className={btn} title={t("inbox.reply", "Répondre")} onMouseDown={stopMD} onClick={click(cb.onReply)}><Reply className="w-3.5 h-3.5" /></button>
      <button className={btn} title={t("inbox.forward", "Transférer")} onMouseDown={stopMD} onClick={click(cb.onForward)}><Forward className="w-3.5 h-3.5" /></button>
      <button className={btn} title={t("inbox.createTask", "Créer une tâche")} onMouseDown={stopMD} onClick={click(cb.onCreateTask)}><ListTodo className="w-3.5 h-3.5" /></button>
      {cb.onCreateAndAssignTask && (
        <button className={btn} title={t("inbox.createAndAssignTask", "Créer et assigner…")} onMouseDown={stopMD} onClick={click(cb.onCreateAndAssignTask)}><UserPlus className="w-3.5 h-3.5" /></button>
      )}
      <button className={btn} title={isUnread ? t("inbox.markAsRead", "Marquer comme lu") : t("inbox.markAsUnread", "Marquer comme non lu")} onMouseDown={stopMD} onClick={click(cb.onToggleRead)}>
        {isUnread ? <MailOpen className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
      </button>
      <div className="relative">
        <button className={btn} title={t("inbox.snooze", "Reporter")} onMouseDown={stopMD} onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === "snooze" ? null : "snooze"); }}><Clock className="w-3.5 h-3.5" /></button>
        {openMenu === "snooze" && (
          <div className={popover} onMouseDown={stopMD}>
            <button className={popoverItem} onMouseDown={stopMD} onClick={click(() => cb.onSnooze(1, t("wave1.snooze1h", "Dans 1 h")))}><Clock className="w-3.5 h-3.5" />{t("wave1.snooze1h", "Dans 1 h")}</button>
            <button className={popoverItem} onMouseDown={stopMD} onClick={click(() => cb.onSnooze(24, t("wave1.snoozeTomorrow", "Demain matin")))}><Bell className="w-3.5 h-3.5" />{t("wave1.snoozeTomorrow", "Demain matin")}</button>
            <button className={popoverItem} onMouseDown={stopMD} onClick={click(() => cb.onSnooze(168, t("wave1.snoozeNextWeek", "Semaine prochaine")))}><CalendarDays className="w-3.5 h-3.5" />{t("wave1.snoozeNextWeek", "Semaine prochaine")}</button>
          </div>
        )}
      </div>
      <button className={btn} title={t("inbox.archive")} onMouseDown={stopMD} onClick={click(cb.onArchive)}><Archive className="w-3.5 h-3.5" /></button>
      {categoryCounts && categoryCounts.length > 0 && (
        <div className="relative">
          <button className={btn} title={t("inbox.category", "Catégorie")} onMouseDown={stopMD} onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === "category" ? null : "category"); }}><Folder className="w-3.5 h-3.5" /></button>
          {openMenu === "category" && (
            <div className={`${popover} max-h-[260px] overflow-y-auto`} onMouseDown={stopMD}>
              {categoryCounts.map((c: any) => (
                <button key={c.categoryId} className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left" onMouseDown={stopMD} onClick={click(() => cb.onSetCategory(c.categoryId, c.categoryName))}>
                  {c.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />}
                  <span className="truncate">{c.categoryName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {userFolders && userFolders.length > 0 && (
        <div className="relative">
          <button className={btn} title={t("inbox.moveToFolder", { defaultValue: "Déplacer vers" })} onMouseDown={stopMD} onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === "move" ? null : "move"); }}><FolderKanban className="w-3.5 h-3.5" /></button>
          {openMenu === "move" && (
            <div className={`${popover} max-h-[260px] overflow-y-auto`} onMouseDown={stopMD}>
              {userFolders.map((f: any) => (
                <button key={f.id} className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left" onMouseDown={stopMD} onClick={click(() => cb.onMove(f.id, f.name))}>
                  <Folder className="w-3 h-3 shrink-0 text-primary/70" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {userProjects && userProjects.length > 0 && cb.onSetProject && (
        <div className="relative">
          <button className={btn} title={t("inbox.assignToProject", { defaultValue: "Affecter à un dossier équipe" })} onMouseDown={stopMD} onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === "project" ? null : "project"); }}><Briefcase className="w-3.5 h-3.5" /></button>
          {openMenu === "project" && (
            <div className={`${popover} max-h-[260px] overflow-y-auto`} onMouseDown={stopMD}>
              {userProjects.map((p: any) => (
                <button key={p.id} className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors text-left" onMouseDown={stopMD} onClick={click(() => cb.onSetProject!(String(p.id), p.name || p.reference || ""))}>
                  <Briefcase className="w-3 h-3 shrink-0 text-primary/70" />
                  <span className="truncate">{p.name || p.reference}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="relative">
        <button className={btn} title={t("inbox.moreActions", { defaultValue: "Plus d'actions" })} onMouseDown={stopMD} onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === "more" ? null : "more"); }}>
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 leading-none text-[14px] font-semibold tracking-tighter">⋯</span>
        </button>
        {openMenu === "more" && (
          <div className={popover} onMouseDown={stopMD}>
            <button className={popoverItem} onMouseDown={stopMD} onClick={click(cb.onCopySender)}><Copy className="w-3.5 h-3.5" />{t("inbox.copySenderEmail", "Copier l'adresse de l'expéditeur")}</button>
            <button className={popoverItem} onMouseDown={stopMD} onClick={click(cb.onCopySubject)}><TypeIcon className="w-3.5 h-3.5" />{t("inbox.copySubject", "Copier le sujet")}</button>
            <button className={popoverItem} onMouseDown={stopMD} onClick={click(cb.onDownloadEml)}><Download className="w-3.5 h-3.5" />{t("inbox.downloadEml", "Télécharger en .eml")}</button>
            <button className={popoverItem} onMouseDown={stopMD} onClick={click(cb.onPrint)}><Printer className="w-3.5 h-3.5" />{t("inbox.print", "Imprimer")}</button>
            {showBlockSender && (
              <button className={popoverItem} onMouseDown={stopMD} onClick={click(cb.onBlockSender)}><ShieldAlert className="w-3.5 h-3.5" />{t("junk.blockSender")}</button>
            )}
          </div>
        )}
      </div>
      <button className="p-1 rounded hover:bg-red-500/[0.08] text-[#8b95a7] hover:text-red-400" title={t("inbox.deleteEmail")} onMouseDown={stopMD} onClick={click(cb.onDelete)}><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}

export const HoverActions = memo(HoverActionsImpl);
