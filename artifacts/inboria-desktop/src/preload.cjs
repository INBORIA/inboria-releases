"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Indicateur léger : permet à l'app web de savoir qu'elle tourne dans la
// coque de bureau Inboria (ex: masquer la bannière « Installer l'app »).
// `pairVault` : la page Paramètres → Inboria Vault → Mon ordinateur peut
// jumeler CET ordinateur en un clic (elle génère le code côté serveur puis
// le passe ici, sans jamais l'afficher). La présence de la fonction sert de
// détection de capacité : les anciennes versions de la coque ne l'ont pas.
contextBridge.exposeInMainWorld("inboriaDesktop", {
  isDesktop: true,
  platform: process.platform,
  pairVault: (code) => ipcRenderer.invoke("vault-claim", String(code || "")),
});
