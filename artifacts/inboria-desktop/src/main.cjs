"use strict";

const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

// ---------------------------------------------------------------------------
// URL de l'app web Inboria chargée par l'application de bureau.
// Modèle Superhuman / Slack / Notion : la coque de bureau affiche l'app web
// hébergée. Il n'y a donc qu'UN seul code à maintenir (le web).
//
// >>> À LA MISE EN PRODUCTION : remplacer la valeur par défaut ci-dessous par
//     le domaine PUBLIÉ d'Inboria (ex: "https://app.inboria.io"), ou définir
//     la variable d'environnement INBORIA_URL au moment du build.
// ---------------------------------------------------------------------------
const APP_URL =
  process.env.INBORIA_URL ||
  "https://2f7c7417-8ab2-41fb-9fcc-9eddd617f0df-00-5fb1cmje57my.picard.replit.dev";

// Page d'entrée de l'app (la web app redirige vers la connexion si besoin).
const START_PATH = "/dashboard";

// Hôtes d'authentification autorisés à s'ouvrir DANS l'app (popups OAuth).
const AUTH_HOSTS = [
  "accounts.google.com",
  "login.microsoftonline.com",
  "login.live.com",
  "login.microsoft.com",
  "supabase.co",
  "supabase.com",
];

let mainWindow = null;

function appOrigin() {
  try {
    return new URL(APP_URL).origin;
  } catch {
    return null;
  }
}

function isInternalUrl(url) {
  try {
    const u = new URL(url);
    if (u.origin === appOrigin()) return true;
    return AUTH_HOSTS.some(
      (h) => u.hostname === h || u.hostname.endsWith("." + h),
    );
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0b1220",
    autoHideMenuBar: true,
    title: "Inboria",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  const startUrl = appOrigin()
    ? new URL(START_PATH, APP_URL).toString()
    : APP_URL;
  mainWindow.loadURL(startUrl);

  // Liens externes (sites tiers, mailto…) → navigateur système.
  // Popups d'auth (Google / Microsoft / Supabase) → fenêtre interne.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          backgroundColor: "#0b1220",
          autoHideMenuBar: true,
        },
      };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Navigation interne reste dans la fenêtre ; le reste part au navigateur.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isInternalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// Mise à jour automatique (electron-updater).
// - Windows & Linux : actif. L'app vérifie au démarrage s'il existe une version
//   plus récente sur GitHub, la télécharge en arrière-plan, puis propose de
//   redémarrer pour l'installer.
// - macOS : DÉSACTIVÉ. Apple exige une app signée/notarisée (compte Apple
//   Developer 99 $/an) pour autoriser l'auto-update ; sans ça l'utilisateur
//   doit retélécharger le .dmg à la main.
// ---------------------------------------------------------------------------
// Vrai = la vérification a été lancée manuellement (menu) → on affiche TOUT
// (à jour / erreur). En automatique au démarrage, on reste discret SAUF erreur,
// qui est désormais visible le temps du diagnostic.
let manualUpdateCheck = false;
let updaterWired = false;

function logUpdate(msg) {
  try {
    const log = require("electron-log");
    log.info("[auto-update] " + msg);
  } catch (_e) {
    /* electron-log optionnel */
  }
  console.log("[auto-update] " + msg);
}

function box(opts) {
  if (!mainWindow) return Promise.resolve({ response: -1 });
  return dialog.showMessageBox(mainWindow, opts).catch(() => ({ response: -1 }));
}

function wireAutoUpdaterOnce() {
  if (updaterWired) return;
  updaterWired = true;

  // Journal dans un fichier : %AppData%\Inboria\logs\main.log (Windows) /
  // ~/.config/Inboria/logs/main.log (Linux). Permet de diagnostiquer à froid.
  try {
    const log = require("electron-log");
    log.transports.file.level = "info";
    autoUpdater.logger = log;
  } catch (_e) {
    /* electron-log non installé : on continue sans fichier de log */
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => logUpdate("vérification en cours…"));

  autoUpdater.on("update-available", (info) => {
    const v = info && info.version ? info.version : "?";
    logUpdate("version disponible : " + v);
    if (manualUpdateCheck) {
      box({
        type: "info",
        buttons: ["OK"],
        title: "Mise à jour d'Inboria",
        message: "Nouvelle version disponible : " + v,
        detail:
          "Téléchargement en cours… Une fenêtre s'affichera dès qu'elle sera " +
          "prête à installer.",
      });
    }
  });

  autoUpdater.on("update-not-available", () => {
    logUpdate("aucune mise à jour (déjà à jour, v" + app.getVersion() + ")");
    if (manualUpdateCheck) {
      box({
        type: "info",
        buttons: ["OK"],
        title: "Mise à jour d'Inboria",
        message: "Inboria est à jour.",
        detail: "Version installée : " + app.getVersion() + ".",
      });
    }
    manualUpdateCheck = false;
  });

  autoUpdater.on("download-progress", (p) => {
    const pct = p && p.percent ? Math.round(p.percent) : 0;
    logUpdate("téléchargement " + pct + "%");
    if (mainWindow) {
      try {
        mainWindow.setProgressBar(pct > 0 ? pct / 100 : -1);
      } catch (_e) {}
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    const v = info && info.version ? info.version : "";
    logUpdate("téléchargement terminé (v" + v + ")");
    if (mainWindow) {
      try {
        mainWindow.setProgressBar(-1);
      } catch (_e) {}
    }
    box({
      type: "info",
      buttons: ["Redémarrer maintenant", "Plus tard"],
      defaultId: 0,
      cancelId: 1,
      title: "Mise à jour d'Inboria",
      message: "Une nouvelle version d'Inboria est prête" + (v ? " (" + v + ")" : "") + ".",
      detail:
        "Vous pouvez redémarrer maintenant pour l'installer, ou plus tard : " +
        "elle s'installera automatiquement à la prochaine fermeture de l'app.",
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
    manualUpdateCheck = false;
  });

  autoUpdater.on("error", (err) => {
    const msg = err && err.message ? err.message : String(err);
    logUpdate("ERREUR : " + msg);
    // Pendant le diagnostic, l'erreur est TOUJOURS visible (manuel ou auto).
    box({
      type: "error",
      buttons: ["OK"],
      title: "Mise à jour d'Inboria",
      message: "La vérification des mises à jour a échoué.",
      detail: msg,
    });
    manualUpdateCheck = false;
  });
}

// manual = true quand l'utilisateur clique « Vérifier les mises à jour ».
function runUpdateCheck(manual) {
  manualUpdateCheck = !!manual;

  if (process.platform === "darwin") {
    if (manual) {
      box({
        type: "info",
        buttons: ["OK"],
        title: "Mise à jour d'Inboria",
        message: "Mise à jour automatique indisponible sur macOS.",
        detail:
          "Elle nécessite un certificat Apple Developer. En attendant, " +
          "téléchargez la dernière version depuis le site d'Inboria.",
      });
    }
    return;
  }

  if (!app.isPackaged) {
    if (manual) {
      box({
        type: "info",
        buttons: ["OK"],
        title: "Mise à jour d'Inboria",
        message: "Indisponible en mode développement.",
        detail: "La mise à jour automatique ne fonctionne que sur l'app installée.",
      });
    }
    return;
  }

  wireAutoUpdaterOnce();
  logUpdate("lancement de la vérification (manuel=" + manual + ", v" + app.getVersion() + ")");
  autoUpdater.checkForUpdates().catch((err) => {
    const msg = err && err.message ? err.message : String(err);
    logUpdate("checkForUpdates a levé : " + msg);
    box({
      type: "error",
      buttons: ["OK"],
      title: "Mise à jour d'Inboria",
      message: "Impossible de vérifier les mises à jour.",
      detail: msg,
    });
  });
}

// Empêche plusieurs instances de l'app.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Menu minimal (raccourcis copier/coller/quitter conservés).
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "Inboria",
          submenu: [
            {
              label: "Vérifier les mises à jour…",
              click: () => runUpdateCheck(true),
            },
            {
              label: "À propos d'Inboria",
              click: () =>
                box({
                  type: "info",
                  buttons: ["OK"],
                  title: "À propos d'Inboria",
                  message: "Inboria",
                  detail: "Version installée : " + app.getVersion(),
                }),
            },
            { type: "separator" },
            { role: "reload", label: "Recharger" },
            { role: "toggleDevTools", label: "Outils de développement" },
            { type: "separator" },
            { role: "quit", label: "Quitter Inboria" },
          ],
        },
        {
          label: "Édition",
          submenu: [
            { role: "undo", label: "Annuler" },
            { role: "redo", label: "Rétablir" },
            { type: "separator" },
            { role: "cut", label: "Couper" },
            { role: "copy", label: "Copier" },
            { role: "paste", label: "Coller" },
            { role: "selectAll", label: "Tout sélectionner" },
          ],
        },
      ]),
    );

    createWindow();
    runUpdateCheck(false);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
