"use strict";

const { contextBridge } = require("electron");

// Indicateur léger : permet à l'app web de savoir qu'elle tourne dans la
// coque de bureau Inboria (ex: masquer la bannière « Installer l'app »).
contextBridge.exposeInMainWorld("inboriaDesktop", {
  isDesktop: true,
  platform: process.platform,
});
