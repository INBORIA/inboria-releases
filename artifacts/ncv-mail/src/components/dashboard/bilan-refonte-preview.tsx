import { Mail, CheckSquare, Download, Calendar, Filter } from "lucide-react";

type MailRow = { name: string; received?: number; openLoad?: number; handled: number; notHandled?: number; delay: string };
type TaskRow = { name: string; open: number; done: number; overdue: number; isOutOfProject?: boolean };

function MailTable({ title, note, rows, mode }: { title: string; note: string; rows: MailRow[]; mode: "member" | "scope" }) {
  return (
    <div className="mb-5">
      <h3 className="text-[12px] font-semibold text-white mb-2">{title}</h3>
      <div className="overflow-hidden rounded-lg border border-[#1f2940] bg-[#0f1729]">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#141c33] text-[#8b9cb3] text-[11px]">
              <th className="text-left px-3 py-2 font-medium">{mode === "member" ? "Membre" : title.includes("projet") ? "Projet" : "Boîte"}</th>
              {mode === "scope" && <th className="text-right px-3 py-2 font-medium">Reçus</th>}
              {mode === "member" && <th className="text-right px-3 py-2 font-medium">Charge ouverte</th>}
              <th className="text-right px-3 py-2 font-medium">Traités</th>
              {mode === "scope" && <th className="text-right px-3 py-2 font-medium">Non traités</th>}
              <th className="text-right px-3 py-2 font-medium">Délai moyen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-[#1f2940]">
                <td className="px-3 py-2 text-white">{r.name}</td>
                {mode === "scope" && <td className="text-right px-3 py-2 text-[#cfd8e8]">{r.received}</td>}
                {mode === "member" && <td className="text-right px-3 py-2 text-[#cfd8e8]">{r.openLoad}</td>}
                <td className="text-right px-3 py-2 text-emerald-400">{r.handled}</td>
                {mode === "scope" && <td className="text-right px-3 py-2 text-amber-400">{r.notHandled}</td>}
                <td className="text-right px-3 py-2 text-[#cfd8e8]">{r.delay}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[#7c8aa3] mt-1.5 italic">{note}</p>
    </div>
  );
}

function TaskTable({ title, note, rows, scope }: { title: string; note: string; rows: TaskRow[]; scope: "member" | "project" }) {
  return (
    <div className="mb-5">
      <h3 className="text-[12px] font-semibold text-white mb-2">{title}</h3>
      <div className="overflow-hidden rounded-lg border border-[#1f2940] bg-[#0f1729]">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#141c33] text-[#8b9cb3] text-[11px]">
              <th className="text-left px-3 py-2 font-medium">{scope === "member" ? "Membre" : "Projet"}</th>
              <th className="text-right px-3 py-2 font-medium">Ouvertes</th>
              <th className="text-right px-3 py-2 font-medium">Terminées</th>
              <th className="text-right px-3 py-2 font-medium">En retard</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-t border-[#1f2940] ${r.isOutOfProject ? "bg-[#141c33]" : ""}`}>
                <td className={`px-3 py-2 ${r.isOutOfProject ? "text-[#8b9cb3] italic" : "text-white"}`}>{r.name}</td>
                <td className="text-right px-3 py-2 text-cyan-400">{r.open}</td>
                <td className="text-right px-3 py-2 text-emerald-400">{r.done}</td>
                <td className="text-right px-3 py-2 text-rose-400">{r.overdue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[#7c8aa3] mt-1.5 italic">{note}</p>
    </div>
  );
}

export function BilanRefontePreview() {
  return (
    <div className="min-h-screen bg-[#0a1020] text-white p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[12px]">
          Aperçu de la refonte (maquette statique avec données fictives) — ajoutez <code>?preview=1</code> pour l'afficher, retirez-le pour revenir au bilan actuel.
        </div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[18px] font-semibold">Bilan quotidien</h1>
            <p className="text-[12px] text-[#8b9cb3] mt-0.5">Vue d'ensemble de l'activité de votre organisation.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-[11px] px-3 py-1.5 rounded-md bg-[#141c33] border border-[#1f2940] text-[#cfd8e8] inline-flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> 7 derniers jours
            </button>
            <button className="text-[11px] px-3 py-1.5 rounded-md bg-[#141c33] border border-[#1f2940] text-[#cfd8e8] inline-flex items-center gap-1.5">
              <Filter className="w-3 h-3" /> Tous projets
            </button>
            <button className="text-[11px] px-3 py-1.5 rounded-md bg-cyan-600 text-white inline-flex items-center gap-1.5">
              <Download className="w-3 h-3" /> Export PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Reçus", value: "12", color: "text-white" },
            { label: "Traités", value: "8", color: "text-emerald-400" },
            { label: "Non traités", value: "4", color: "text-amber-400" },
            { label: "Délai moyen", value: "42 min", color: "text-cyan-400" },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-[#1f2940] bg-[#0f1729] p-3">
              <div className="text-[10px] text-[#8b9cb3] uppercase tracking-wide">{k.label}</div>
              <div className={`text-[20px] font-semibold mt-1 ${k.color}`}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#1f2940]">
            <Mail className="w-4 h-4 text-cyan-400" />
            <h2 className="text-[14px] font-semibold text-white">Mails</h2>
          </div>

          <MailTable
            title="Par membre"
            note="La charge ouverte correspond aux emails assignés à chaque membre et toujours à traiter. Les emails de boîtes partagées non assignés ne sont pas comptés ici."
            mode="member"
            rows={[
              { name: "Jean Neybergh", openLoad: 3, handled: 5, delay: "36 min" },
              { name: "Richard Martin", openLoad: 1, handled: 3, delay: "28 min" },
            ]}
          />

          <MailTable
            title="Par boîte partagée"
            note="Volume reçu et traité par boîte partagée de l'organisation."
            mode="scope"
            rows={[
              { name: "support@inboria.com", received: 8, handled: 5, notHandled: 3, delay: "45 min" },
              { name: "sales@inboria.com", received: 2, handled: 2, notHandled: 0, delay: "12 min" },
            ]}
          />

          <MailTable
            title="Par boîte personnelle"
            note="Volume des boîtes personnelles connectées par chaque membre."
            mode="scope"
            rows={[
              { name: "jean@inboria.com", received: 1, handled: 1, notHandled: 0, delay: "18 min" },
              { name: "richard@inboria.com", received: 1, handled: 0, notHandled: 1, delay: "—" },
            ]}
          />

          <MailTable
            title="Par projet"
            note="Les emails non rattachés à un projet n'apparaissent pas dans ce tableau."
            mode="scope"
            rows={[
              { name: "INBORIA CRM [Hubspot]", received: 3, handled: 2, notHandled: 1, delay: "22 min" },
            ]}
          />
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#1f2940]">
            <CheckSquare className="w-4 h-4 text-violet-400" />
            <h2 className="text-[14px] font-semibold text-white">Tâches</h2>
          </div>

          <TaskTable
            title="Par membre"
            note="Tâches assignées à chaque membre. Statut basé sur la date d'échéance."
            scope="member"
            rows={[
              { name: "Jean Neybergh", open: 5, done: 12, overdue: 2 },
              { name: "Richard Martin", open: 2, done: 8, overdue: 0 },
            ]}
          />

          <TaskTable
            title="Par projet"
            note="Tâches rattachées à un projet. La ligne « Hors projet » regroupe les tâches sans projet associé."
            scope="project"
            rows={[
              { name: "INBORIA CRM [Hubspot]", open: 3, done: 5, overdue: 1 },
              { name: "Hors projet", open: 4, done: 15, overdue: 1, isOutOfProject: true },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
