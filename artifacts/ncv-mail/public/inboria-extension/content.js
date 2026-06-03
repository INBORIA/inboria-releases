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
  // Passe à true dès qu'on a reçu un 1er message du panneau : preuve que
  // l'iframe a fini de charger sur son origine chrome-extension:// et qu'on
  // peut donc lui postMessage en ciblant EXT_ORIGIN sans erreur.
  var frameReady = false;
  // Détection des changements de mail dans les webmails « single-page » (OWA,
  // Gmail…) : la page ne se recharge PAS quand on change de mail, donc on
  // surveille le DOM + l'URL et on renvoie le contexte au panneau dès que le
  // mail affiché change réellement (sinon le panneau reste collé sur l'ancien).
  var lastCtxKey = "";
  var rescanTimer = null;
  var pollTimer = null;
  var domObserver = null;
  var historyPatched = false;
  var origPushState = null;
  var origReplaceState = null;

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

    // Zone de lecture probable (sert d'ancrage aux heuristiques universelles).
    var readRoot =
      document.querySelector(
        "[aria-label*='Message body' i], [aria-label*='Reading' i], [role='main'], #ReadingPaneContainer, .ReadingPaneContent",
      ) || document.body;

    if (!ctx.subject) {
      ctx.subject = txt(
        document.querySelector(
          "h1.subject, .subject, [data-testid='message-subject'], [aria-label='Subject'], [aria-label*='Subject' i]",
        ),
      );
    }
    // OWA / Exchange (OVH Pro) : le sujet est un titre dans la zone de lecture.
    if (!ctx.subject && readRoot) {
      var heads = readRoot.querySelectorAll(
        "[role='heading'], h1, h2, [aria-level='2'], [aria-level='1']",
      );
      for (var hi = 0; hi < heads.length; hi++) {
        var ht = txt(heads[hi]);
        if (ht && ht.length >= 2 && ht.length <= 250) {
          ctx.subject = ht;
          break;
        }
      }
    }
    if (!ctx.from) {
      ctx.from = txt(
        document.querySelector(
          "[data-testid='message-sender'], .sender, .from .adr, span.adr, [aria-label*='From' i]",
        ),
      );
    }
    // Repli universel pour l'expéditeur : 1re adresse e-mail trouvée dans la
    // zone de lecture (lien mailto: en priorité, sinon scan du texte). En OWA
    // l'expéditeur apparaît en tête du message → c'est quasi toujours le bon.
    if (readRoot) {
      var foundEmail = "";
      try {
        var mailtoEl = readRoot.querySelector("a[href^='mailto:' i]");
        if (mailtoEl) {
          var href = decodeURIComponent(
            (mailtoEl.getAttribute("href") || "").slice(7),
          ).split("?")[0];
          if (/@/.test(href)) foundEmail = href.trim();
        }
      } catch (e) {}
      if (!foundEmail) {
        var rt = txt(readRoot).slice(0, 2000);
        var em = rt.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
        if (em) foundEmail = em[0];
      }
      // Si `from` n'a pas d'adresse @, on l'enrichit avec l'e-mail trouvé.
      if (foundEmail && !/@/.test(ctx.from)) {
        ctx.from = ctx.from ? ctx.from + " <" + foundEmail + ">" : foundEmail;
      }
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

  function ctxKey(c) {
    return (
      (c.subject || "") +
      "||" +
      (c.from || "") +
      "||" +
      String((c.body || "").length)
    );
  }

  function postContext(c) {
    if (!frame || !frame.contentWindow || !frameReady) return;
    try {
      frame.contentWindow.postMessage(
        { source: "inboria-content", type: "context", context: c },
        EXT_ORIGIN,
      );
      lastCtxKey = ctxKey(c);
    } catch (e) {}
  }

  function sendContext() {
    postContext(scrapeContext());
  }

  // Re-scrape et renvoie le contexte UNIQUEMENT si le mail a réellement changé
  // (évite de spammer le panneau à chaque micro-mutation du DOM d'OWA).
  function maybeResend() {
    if (!panelOpen || !frameReady) return;
    var c = scrapeContext();
    if (ctxKey(c) === lastCtxKey) return;
    postContext(c);
  }

  function scheduleRescan() {
    if (!panelOpen) return;
    if (rescanTimer) clearTimeout(rescanTimer);
    rescanTimer = setTimeout(maybeResend, 400);
  }

  // OWA/Gmail naviguent par history API sans recharger : on instrumente
  // push/replaceState pour réagir au changement de mail dans l'URL. Réversible
  // (restauré à la fermeture du panneau) pour ne rien laisser sur le webmail.
  function patchHistory() {
    if (historyPatched) return;
    historyPatched = true;
    origPushState = history.pushState;
    origReplaceState = history.replaceState;
    if (typeof origPushState === "function") {
      history.pushState = function () {
        var r = origPushState.apply(this, arguments);
        try {
          scheduleRescan();
        } catch (e) {}
        return r;
      };
    }
    if (typeof origReplaceState === "function") {
      history.replaceState = function () {
        var r = origReplaceState.apply(this, arguments);
        try {
          scheduleRescan();
        } catch (e) {}
        return r;
      };
    }
  }

  function unpatchHistory() {
    if (!historyPatched) return;
    historyPatched = false;
    if (origPushState) history.pushState = origPushState;
    if (origReplaceState) history.replaceState = origReplaceState;
    origPushState = null;
    origReplaceState = null;
  }

  // Surveillance active UNIQUEMENT pendant que le panneau est ouvert :
  // observateur DOM (débit limité par scheduleRescan) + écouteurs URL + sondage
  // léger de secours (1,5 s). Tout est démonté par stopWatch à la fermeture.
  function startWatch() {
    window.addEventListener("hashchange", scheduleRescan);
    window.addEventListener("popstate", scheduleRescan);
    patchHistory();
    if (!domObserver) {
      domObserver = new MutationObserver(function () {
        scheduleRescan();
      });
    }
    try {
      domObserver.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
    if (!pollTimer) pollTimer = setInterval(maybeResend, 1500);
  }

  function stopWatch() {
    window.removeEventListener("hashchange", scheduleRescan);
    window.removeEventListener("popstate", scheduleRescan);
    unpatchHistory();
    if (domObserver) {
      try {
        domObserver.disconnect();
      } catch (e) {}
    }
    if (rescanTimer) {
      clearTimeout(rescanTimer);
      rescanTimer = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
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
    startWatch();
  }

  function closePanel() {
    if (frame) frame.classList.remove("inboria-ext-open");
    panelOpen = false;
    if (btn) btn.classList.remove("inboria-ext-hidden");
    stopWatch();
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

  // Ouvre une URL externe uniquement si elle est sûre (https), jamais
  // javascript:/data:/etc. — défense en profondeur contre un détournement.
  function openExternal(url) {
    try {
      var u = new URL(String(url));
      if (u.protocol !== "https:") return;
      window.open(u.href, "_blank", "noopener");
    } catch (e) {}
  }

  // ---- Messages venant du panneau -----------------------------------------
  // Sécurité : on n'accepte QUE les messages qui (1) viennent de l'origine de
  // notre page d'extension, (2) proviennent exactement de l'iframe du panneau,
  // (3) portent la signature attendue. Tout le reste est ignoré.
  window.addEventListener("message", function (ev) {
    if (ev.origin !== EXT_ORIGIN) return;
    if (!frame || ev.source !== frame.contentWindow) return;
    var d = ev.data;
    if (!d || d.source !== "inboria-panel") return;
    // Le panneau nous parle => il est chargé sur chrome-extension:// : on peut
    // désormais lui envoyer le contexte sans erreur d'origine.
    frameReady = true;
    if (d.type === "ready" || d.type === "request-context") {
      sendContext();
    } else if (d.type === "open" && d.url) {
      openExternal(d.url);
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
