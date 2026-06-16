"use strict";

const { app, BrowserWindow, shell, Menu } = require("electron");
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
const APP_URL = process.env.INBORIA_URL || "https://inboria.com";

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

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
