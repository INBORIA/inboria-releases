import { supabase } from "./supabase";

function extToMime(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    csv: "text/csv",
    eml: "message/rfc822",
    pdf: "application/pdf",
    json: "application/json",
    txt: "text/plain",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    zip: "application/zip",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  return map[ext] || "application/octet-stream";
}

function buildAcceptTypes(filename: string): Array<{ description: string; accept: Record<string, string[]> }> {
  const ext = "." + (filename.toLowerCase().split(".").pop() || "bin");
  const mime = extToMime(filename);
  const descMap: Record<string, string> = {
    ".csv": "Fichier CSV",
    ".eml": "Email (.eml)",
    ".pdf": "PDF",
    ".json": "JSON",
    ".txt": "Texte",
    ".xlsx": "Excel",
    ".xls": "Excel",
    ".zip": "Archive ZIP",
  };
  return [{ description: descMap[ext] || "Fichier", accept: { [mime]: [ext] } }];
}

/**
 * Sauvegarde un Blob avec choix du dossier de destination.
 * - Chrome/Edge (Windows/Mac/Linux) : ouvre la boîte "Enregistrer sous" via File System Access API.
 * - Firefox/Safari : retombe sur le téléchargement classique (dossier Téléchargements ou
 *   boîte selon les réglages du navigateur).
 */
export async function saveBlobAs(blob: Blob, filename: string): Promise<void> {
  const w = window as unknown as {
    showSaveFilePicker?: (opts: {
      suggestedName?: string;
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }>;
  };
  if (typeof w.showSaveFilePicker === "function") {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: buildAcceptTypes(filename),
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      // L'utilisateur a annulé : on ne fait rien.
      if ((err as { name?: string })?.name === "AbortError") return;
      // Sinon on retombe sur le téléchargement classique.
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}

export async function downloadExport(path: string, filename: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    throw new Error("Non authentifié");
  }

  const url = `${import.meta.env.BASE_URL}api/${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Export échoué (${response.status})`);
  }

  const blob = await response.blob();
  await saveBlobAs(blob, filename);
}
