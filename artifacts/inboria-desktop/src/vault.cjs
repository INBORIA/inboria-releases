"use strict";

// Inboria Vault — « Mon ordinateur ».
// L'application de bureau se jumelle au compte (code court affiché dans
// Paramètres → Inboria Vault), puis dépose dans un dossier local choisi par
// l'utilisateur les documents rangés depuis l'app web (« Ranger » /
// « Ranger par Inboria »). Le serveur ne garde le fichier que quelques
// minutes en transit ; c'est cette app qui le fait vivre CHEZ l'abonné.
//
// Réglage local (userData/vault.json) : { apiBase, deviceToken, rootFolder }.
// Le jeton d'appareil ne donne accès qu'à la file de transit du Vault.

const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

const APP_URL = process.env.INBORIA_URL || "https://inboria.com";
const POLL_MS = 5000;

let settings = null;
let pollTimer = null;
let polling = false;
let getParentWindow = () => null;

function settingsPath() {
  return path.join(app.getPath("userData"), "vault.json");
}

// Dossier général : tout ce que range Inboria vit dans un sous-dossier
// « Inboria Vault » de l'emplacement choisi (jamais en vrac sur le Bureau).
const VAULT_DIR_NAME = "Inboria Vault";

function ensureVaultRoot(folder) {
  const root =
    path.basename(folder) === VAULT_DIR_NAME ? folder : path.join(folder, VAULT_DIR_NAME);
  try {
    fs.mkdirSync(root, { recursive: true });
  } catch (e) {
    console.error("[vault] impossible de créer le dossier Inboria Vault :", e.message);
  }
  return root;
}

function loadSettings() {
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
  } catch (_e) {
    settings = null;
  }
  // Migration douce des installations existantes : on englobe l'emplacement
  // déjà choisi dans « Inboria Vault » (les fichiers déjà déposés restent où
  // ils sont ; les prochains dépôts arrivent dans le dossier général).
  if (settings && settings.rootFolder && path.basename(settings.rootFolder) !== VAULT_DIR_NAME) {
    saveSettings(
      Object.assign({}, settings, { rootFolder: ensureVaultRoot(settings.rootFolder) }),
    );
  }
}

function saveSettings(next) {
  settings = next;
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), "utf8");
  } catch (e) {
    console.error("[vault] impossible d'enregistrer le réglage :", e.message);
  }
}

function apiBase() {
  return ((settings && settings.apiBase) || APP_URL).replace(/\/+$/, "");
}

async function apiFetch(pathname, options = {}) {
  const headers = Object.assign(
    {},
    options.headers || {},
    settings && settings.deviceToken
      ? { Authorization: "Bearer " + settings.deviceToken }
      : {},
  );
  return fetch(apiBase() + pathname, Object.assign({}, options, { headers }));
}

// ---------------------------------------------------------------------------
// Écriture locale sûre : segments assainis (jamais de « .. », de « / » ni de
// caractères interdits), et vérification finale que la cible reste DANS le
// dossier racine choisi.
// ---------------------------------------------------------------------------

function sanitizeLocalSegment(segment) {
  const clean = String(segment || "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean || /^\.+$/.test(clean)) return null;
  return clean;
}

function uniquePath(dir, filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = path.join(dir, filename);
  let i = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, base + " (" + i + ")" + ext);
    i += 1;
    if (i > 200) throw new Error("too_many_duplicates");
  }
  return candidate;
}

function writeItemLocally(item, buffer) {
  const root = settings && settings.rootFolder;
  if (!root || !fs.existsSync(root)) throw new Error("root_folder_missing");
  const segments = String(item.folder_path || "")
    .split("/")
    .map(sanitizeLocalSegment)
    .filter(Boolean);
  const dir = path.join(root, ...segments);
  const resolvedRoot = path.resolve(root) + path.sep;
  if (!(path.resolve(dir) + path.sep).startsWith(resolvedRoot)) {
    throw new Error("path_escape_blocked");
  }
  fs.mkdirSync(dir, { recursive: true });
  const name = sanitizeLocalSegment(item.filename) || "document";
  const target = uniquePath(dir, name);
  if (!path.resolve(target).startsWith(resolvedRoot)) {
    throw new Error("path_escape_blocked");
  }
  fs.writeFileSync(target, buffer);
  return target;
}

// ---------------------------------------------------------------------------
// Boucle de dépôt : interroge la file, télécharge, écrit, confirme.
// La requête « queue » sert aussi de signal de présence (« Connecté »).
// ---------------------------------------------------------------------------

async function processQueueOnce() {
  if (!settings || !settings.deviceToken || !settings.rootFolder) return;
  if (polling) return;
  polling = true;
  try {
    const r = await apiFetch("/api/vault/desktop/queue");
    if (r.status === 401) {
      // Appareil dissocié depuis les Paramètres : on arrête proprement.
      console.log("[vault] appareil dissocié — jumelage requis");
      saveSettings(Object.assign({}, settings, { deviceToken: null }));
      stopPolling();
      return;
    }
    if (!r.ok) return;
    const body = await r.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items : [];
    for (const item of items) {
      try {
        const cr = await apiFetch("/api/vault/desktop/items/" + item.id + "/content");
        if (!cr.ok) {
          await apiFetch("/api/vault/desktop/items/" + item.id + "/fail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "content_fetch_failed" }),
          });
          continue;
        }
        const buffer = Buffer.from(await cr.arrayBuffer());
        const target = writeItemLocally(item, buffer);
        await apiFetch("/api/vault/desktop/items/" + item.id + "/confirm", { method: "POST" });
        console.log("[vault] déposé :", target);
      } catch (e) {
        console.error("[vault] dépôt raté :", e.message);
        await apiFetch("/api/vault/desktop/items/" + item.id + "/fail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: String(e.message || "desktop_error").slice(0, 200) }),
        }).catch(() => {});
      }
    }
  } catch (_e) {
    /* hors ligne : on réessaie au prochain tour */
  } finally {
    polling = false;
  }
}

function startPolling() {
  stopPolling();
  if (!settings || !settings.deviceToken || !settings.rootFolder) return;
  pollTimer = setInterval(processQueueOnce, POLL_MS);
  processQueueOnce();
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

// ---------------------------------------------------------------------------
// Jumelage : petite fenêtre locale (code + choix du dossier).
// ---------------------------------------------------------------------------

const PAIR_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:system-ui,sans-serif;background:#0b1220;color:#fff;margin:0;padding:24px}
h1{font-size:15px;margin:0 0 6px}p{font-size:12px;color:#b8c5d6;margin:0 0 16px}
input{width:100%;box-sizing:border-box;font-size:20px;letter-spacing:6px;text-align:center;
padding:10px;border-radius:8px;border:1px solid #2a3a55;background:#101a2e;color:#fff;text-transform:uppercase}
button{margin-top:14px;width:100%;padding:10px;border-radius:8px;border:none;background:#2b7fff;
color:#fff;font-size:13px;cursor:pointer}button:disabled{opacity:.5}
.err{color:#ff8080;font-size:12px;margin-top:10px;min-height:16px}
</style></head><body>
<h1>Connecter mon Vault</h1>
<p>Dans Inboria, ouvrez Paramètres → Inboria Vault → Mon ordinateur, générez un code de jumelage et saisissez-le ici.</p>
<input id="code" maxlength="9" placeholder="XXXX-XXXX" autofocus>
<button id="go">Connecter</button>
<div class="err" id="err"></div>
<script>
const { ipcRenderer } = require("electron");
const btn=document.getElementById("go"),input=document.getElementById("code"),err=document.getElementById("err");
async function submit(){btn.disabled=true;err.textContent="";
const r=await ipcRenderer.invoke("vault-claim",input.value);
if(!r.ok){err.textContent=r.message||"Code refusé";btn.disabled=false;}}
btn.addEventListener("click",submit);
input.addEventListener("keydown",e=>{if(e.key==="Enter")submit();});
</script></body></html>`;

let pairWindow = null;

function openPairingWindow() {
  if (pairWindow) {
    pairWindow.focus();
    return;
  }
  pairWindow = new BrowserWindow({
    width: 380,
    height: 320,
    resizable: false,
    parent: getParentWindow() || undefined,
    autoHideMenuBar: true,
    backgroundColor: "#0b1220",
    title: "Inboria Vault",
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  pairWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(PAIR_HTML));
  pairWindow.on("closed", () => {
    pairWindow = null;
  });
}

async function chooseRootFolder() {
  const parent = getParentWindow();
  const result = await dialog.showOpenDialog(parent || undefined, {
    title: "Choisir le dossier du Vault",
    buttonLabel: "Choisir ce dossier",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
}

async function handleClaim(rawCode) {
  try {
    const r = await fetch(apiBase() + "/api/vault/desktop/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: String(rawCode || "").trim(),
        deviceName: os.hostname(),
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body.ok || !body.deviceToken) {
      return {
        ok: false,
        message:
          body && body.error === "pairing_code_invalid"
            ? "Code refusé ou expiré — générez-en un nouveau."
            : "Connexion impossible. Vérifiez votre connexion internet.",
      };
    }
    const folder = await chooseRootFolder();
    if (!folder) {
      return { ok: false, message: "Choisissez le dossier où rangera Inboria." };
    }
    const vaultRoot = ensureVaultRoot(folder);
    saveSettings({ apiBase: apiBase(), deviceToken: body.deviceToken, rootFolder: vaultRoot });
    startPolling();
    if (pairWindow) pairWindow.close();
    const parent = getParentWindow();
    if (parent) {
      dialog.showMessageBox(parent, {
        type: "info",
        buttons: ["OK"],
        title: "Inboria Vault",
        message: "Vault connecté.",
        detail: "Les documents rangés depuis Inboria arriveront dans :\n" + folder,
      });
    }
    return { ok: true };
  } catch (_e) {
    return { ok: false, message: "Connexion impossible. Vérifiez votre connexion internet." };
  }
}

function initVault(getWindow) {
  getParentWindow = getWindow;
  loadSettings();
  ipcMain.handle("vault-claim", (_event, code) => handleClaim(code));
  startPolling();
}

async function changeRootFolder() {
  if (!settings || !settings.deviceToken) {
    openPairingWindow();
    return;
  }
  const folder = await chooseRootFolder();
  if (folder) {
    saveSettings(Object.assign({}, settings, { rootFolder: ensureVaultRoot(folder) }));
    startPolling();
  }
}

module.exports = { initVault, openPairingWindow, changeRootFolder };
