/* Inboria — script de contenu de l'extension navigateur.
 *
 * Rôle (Étape 1 — socle) :
 *  - Détecter si la page est un webmail.
 *  - Injecter le bouton flottant « Demander à Inboria ».
 *  - Ouvrir/fermer un panneau latéral (iframe -> panel.html, page de l'extension)
 *    qui réutilise EXACTEMENT le moteur serveur d'Inboria (config/chat/resolve).
 *  - Lire au mieux le mail affiché (objet / expéditeur / corps) et l'envoyer au
 *    panneau par postMessage. La lecture fine par webmail viendra à l'Étape 2.
 */
(function () {
  "use strict";
  if (window.__inboriaExtLoaded) return;
  window.__inboriaExtLoaded = true;

  var PANEL_URL = chrome.runtime.getURL("panel.html");
  var ICON_URL = chrome.runtime.getURL("icon-128.png");
  var EXT_ORIGIN = new URL(PANEL_URL).origin;

  var btn = null;
  var frame = null;
  var panelOpen = false;

  // ---- Détection webmail ---------------------------------------------------
  function isWebmail() {
    try {
      var h = location.hostname.toLowerCase();
      var hostHit =
        /(^|\.)(mail|webmail|roundcube|zimbra|owa|outlook|gmx|zoho|yahoo|icloud|fastmail|proton)\./.test(
          h,
        ) ||
        /mail\.google\.com$/.test(h) ||
        (/ovh|ovhcloud/.test(h) && /mail|webmail/.test(location.href.toLowerCase()));
      if (hostHit) return true;
      // Signatures DOM (Roundcube, Zimbra, Gmail/Outlook web…).
      if (
        document.querySelector(
          '#rcmbody, #mainscreen, #messagelist, .rcmail, meta[name="generator"][content*="Roundcube" i], #zimbramailbox, div[role="main"] div[data-message-id], [aria-label*="Message body" i]',
        )
      ) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  // ---- Lecture du mail affiché (best-effort, Étape 1) ----------------------
  function txt(el) {
    return el ? String(el.innerText || el.textContent || "").trim() : "";
  }

  function scrapeContext() {
    var ctx = { subject: "", from: "", body: "", messageId: "", nativeId: "" };

    var selection = "";
    try {
      selection = window.getSelection
        ? String(window.getSelection().toString()).trim()
        : "";
    } catch (e) {}

    // Roundcube : la vue du message est dans une iframe MÊME ORIGINE → lisible.
    var rcFrame = document.querySelector("#messagecontframe, #messageframe");
    if (rcFrame) {
      ctx.subject = txt(
        document.querySelector(
          ".subject, #messageheader .subject, .header .subject",
        ),
      );
      ctx.from = txt(
        document.querySelector(
          ".rcmContactAddress, #messageheader .adr, .header .adr, span.adr",
        ),
      );
      try {
        var d = rcFrame.contentDocument;
        if (d && d.body) ctx.body = String(d.body.innerText || "").trim();
      } catch (e) {}
    }

    if (!ctx.subject) {
      ctx.subject = txt(
        document.querySelector(
          "h1.subject, .subject, [data-testid='message-subject'], [aria-label='Subject']",
        ),
      );
    }
    if (!ctx.from) {
      ctx.from = txt(
        document.querySelector(
          "[data-testid='message-sender'], .sender, .from .adr, span.adr",
        ),
      );
    }
    if (!ctx.body) {
      var sels = [
        ".message-body",
        ".mail-body",
        "#messagebody",
        ".messageBody",
        "[data-testid='message-body']",
        "[aria-label*='Message body' i]",
        "[role='article']",
        "article",
      ];
      for (var i = 0; i < sels.length; i++) {
        var b = txt(document.querySelector(sels[i]));
        if (b.length > 40) {
          ctx.body = b;
          break;
        }
      }
    }
    // Repli universel : texte sélectionné par l'utilisateur.
    if (!ctx.body && selection) ctx.body = selection;

    ctx.body = ctx.body.slice(0, 8000);
    if (!ctx.subject) ctx.subject = String(document.title || "").slice(0, 200);
    return ctx;
  }

  // ---- Panneau -------------------------------------------------------------
  function ensureFrame() {
    if (frame) return frame;
    frame = document.createElement("iframe");
    frame.className = "inboria-ext-panel";
    frame.src = PANEL_URL;
    frame.setAttribute("title", "Demander à Inboria");
    frame.setAttribute("allow", "clipboard-write");
    document.documentElement.appendChild(frame);
    return frame;
  }

  function sendContext() {
    if (!frame || !frame.contentWindow) return;
    try {
      frame.contentWindow.postMessage(
        { source: "inboria-content", type: "context", context: scrapeContext() },
        EXT_ORIGIN,
      );
    } catch (e) {}
  }

  function openPanel() {
    ensureFrame();
    // Laisse l'iframe se monter avant la transition.
    requestAnimationFrame(function () {
      frame.classList.add("inboria-ext-open");
    });
    panelOpen = true;
    if (btn) btn.classList.add("inboria-ext-hidden");
    sendContext();
  }

  function closePanel() {
    if (frame) frame.classList.remove("inboria-ext-open");
    panelOpen = false;
    if (btn) btn.classList.remove("inboria-ext-hidden");
  }

  // ---- Bouton flottant -----------------------------------------------------
  function buildButton() {
    if (btn) return;
    btn = document.createElement("button");
    btn.className = "inboria-ext-btn";
    btn.type = "button";
    var img = document.createElement("img");
    img.src = ICON_URL;
    img.alt = "";
    var label = document.createElement("span");
    label.textContent = "Demander à Inboria";
    btn.appendChild(img);
    btn.appendChild(label);
    btn.addEventListener("click", function () {
      if (panelOpen) closePanel();
      else openPanel();
    });
    document.documentElement.appendChild(btn);
  }

  // ---- Messages venant du panneau -----------------------------------------
  window.addEventListener("message", function (ev) {
    var d = ev.data;
    if (!d || d.source !== "inboria-panel") return;
    if (frame && ev.source !== frame.contentWindow) return;
    if (d.type === "ready" || d.type === "request-context") {
      sendContext();
    } else if (d.type === "open" && d.url) {
      window.open(d.url, "_blank", "noopener");
    } else if (d.type === "close") {
      closePanel();
    }
  });

  // ---- Démarrage -----------------------------------------------------------
  function start() {
    if (!isWebmail()) return;
    buildButton();
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
