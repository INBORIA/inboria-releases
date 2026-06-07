/* Inboria — taskpane de l'add-in Outlook.
 * Page statique (hors bundle Vite) : pas d'import.meta, vanilla JS.
 * - Récupère la config publique Supabase via /api/inboria/addin-config
 * - Authentifie l'utilisateur (email/mot de passe Supabase) et garde la session
 * - Réutilise l'IA existante via POST /api/inboria/chat (Bearer JWT)
 * - « Ouvrir dans Inboria » : résout le Message-ID -> id interne et ouvre l'app
 */
(function () {
  "use strict";

  var SESSION_KEY = "inboria.addin.session";
  var ORIGIN = window.location.origin; // taskpane servi depuis le domaine de l'app
  var cfg = { supabaseUrl: "", supabaseAnonKey: "" };
  var session = null; // { access_token, refresh_token, expires_at, email }
  var history = []; // [{ role, content }]
  var currentEmailId = null; // id interne résolu (peut rester null)
  var currentEmailMsgId = null; // internetMessageId pour lequel currentEmailId a été résolu
  var itemChangedWired = false; // handler ItemChanged enregistré une seule fois
  var busy = false;

  function $(id) { return document.getElementById(id); }
  function show(view) {
    ["loading", "login", "chat"].forEach(function (v) {
      $("view-" + v).classList.toggle("hidden", v !== view);
    });
  }

  // ---- Session storage -----------------------------------------------------
  function loadSession() {
    try {
      var raw = window.localStorage.getItem(SESSION_KEY);
      session = raw ? JSON.parse(raw) : null;
    } catch (e) { session = null; }
  }
  function saveSession(s) {
    session = s;
    try { window.localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function clearSession() {
    session = null;
    try { window.localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  // ---- Auth (Supabase REST) ------------------------------------------------
  function storeTokenResponse(data) {
    var expiresAt = data.expires_at
      ? data.expires_at * 1000
      : Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600000);
    saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
      email: (data.user && data.user.email) || (session && session.email) || "",
    });
  }

  function login(email, password) {
    return fetch(cfg.supabaseUrl + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.supabaseAnonKey,
      },
      body: JSON.stringify({ email: email, password: password }),
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          throw new Error(data.error_description || data.msg || data.error || "Identifiants invalides.");
        }
        storeTokenResponse(data);
        return data;
      });
    });
  }

  function refresh() {
    if (!session || !session.refresh_token) return Promise.reject(new Error("no session"));
    return fetch(cfg.supabaseUrl + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    }).then(function (r) {
      if (!r.ok) throw new Error("refresh failed");
      return r.json().then(function (data) { storeTokenResponse(data); return data; });
    });
  }

  // Renvoie un access_token valide (rafraîchi si proche de l'expiration).
  function getAccessToken() {
    if (!session) return Promise.reject(new Error("not authenticated"));
    var soon = Date.now() + 60000; // marge 60s
    if (session.expires_at && session.expires_at > soon) {
      return Promise.resolve(session.access_token);
    }
    return refresh().then(function () { return session.access_token; });
  }

  // ---- API app -------------------------------------------------------------
  function apiFetch(path, options) {
    return getAccessToken().then(function (token) {
      var opts = options || {};
      opts.headers = Object.assign({}, opts.headers, {
        Authorization: "Bearer " + token,
      });
      return fetch(ORIGIN + path, opts);
    });
  }

  function callChat(message) {
    history.push({ role: "user", content: message });
    var body = {
      messages: history.slice(-20),
      currentRoute: "/outlook-addin",
      uiLang: "fr",
    };
    if (currentEmailId) body.currentEmailId = currentEmailId;
    return apiFetch("/api/inboria/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.error || "Inboria est momentanément indisponible.");
        history.push({ role: "assistant", content: data.reply || "" });
        return data.reply || "";
      });
    });
  }

  // Transforme les blocs ```inboria-draft / yaml en texte lisible (cas SANS carte).
  function cleanReply(text) {
    if (!text) return "";
    return text
      .replace(/```inboria-draft\s*([\s\S]*?)```/g, function (_m, inner) {
        return "\n" + extractDraftBody(inner);
      })
      .replace(/```[a-z-]*\s*([\s\S]*?)```/g, function (_m, inner) { return inner.trim(); })
      // Pas de carte ici pour les blocs RDV : on retire la consigne du prompt
      // qui renvoie vers des boutons inexistants.
      .replace(
        /Cliquez sur [^.]*\b(?:Envoyer|Modifier|Bloquer)\b[^.]*\.(?:\s*(?:Inboria|Le RDV)[^.]*\.)?/gi,
        "",
      )
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // Extrait proprement le corps d'un bloc inboria-draft (gère "body: |" + indentation).
  function extractDraftBody(inner) {
    var m = inner.match(/body:\s*\|?[ \t]*\r?\n([\s\S]*)$/i);
    if (!m) {
      var m2 = inner.match(/body:\s*(.*)$/i);
      return m2 ? m2[1].trim() : inner.trim();
    }
    var lines = m[1].replace(/\s+$/, "").split(/\r?\n/);
    var min = Infinity;
    lines.forEach(function (l) {
      if (l.trim()) {
        var n = l.match(/^[ \t]*/)[0].length;
        if (n < min) min = n;
      }
    });
    if (!isFinite(min)) min = 0;
    return lines
      .map(function (l) { return l.slice(min); })
      .join("\n")
      .trim();
  }

  // Repère un brouillon de réponse et en extrait to / subject / body + intro.
  function parseDraft(raw) {
    if (!raw) return null;
    var m = raw.match(/```inboria-draft\s*([\s\S]*?)```/);
    if (!m) return null;
    var inner = m[1];
    var to = (inner.match(/^[ \t]*to:\s*(.+)$/im) || [])[1] || "";
    var subject = (inner.match(/^[ \t]*subject:\s*(.+)$/im) || [])[1] || "";
    var body = extractDraftBody(inner);
    var intro = raw
      .slice(0, m.index)
      .replace(
        /Cliquez sur [^.]*\b(?:Envoyer|Modifier|Bloquer)\b[^.]*\.(?:\s*(?:Inboria|Le RDV)[^.]*\.)?/gi,
        "",
      )
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return { to: to.trim(), subject: subject.trim(), body: body, intro: intro };
  }

  // Carte brouillon avec vrais boutons « Envoyer » + « Modifier dans Inboria ».
  function renderDraftCard(draft) {
    var box = $("messages");
    var card = document.createElement("div");
    card.className = "msg bot";

    if (draft.intro) {
      var intro = document.createElement("div");
      intro.style.marginBottom = "8px";
      renderMailRefs(intro, draft.intro);
      card.appendChild(intro);
    }

    var preview = document.createElement("div");
    preview.style.cssText =
      "white-space:pre-wrap;border:1px solid rgba(148,163,184,.25);" +
      "background:rgba(148,163,184,.08);border-radius:8px;padding:10px;" +
      "font-size:13px;line-height:1.5;margin-bottom:8px;";
    if (draft.subject) {
      var subj = document.createElement("div");
      subj.style.cssText = "font-weight:600;margin-bottom:6px;";
      subj.textContent = "Objet : " + draft.subject;
      preview.appendChild(subj);
    }
    var bodyEl = document.createElement("div");
    renderMailRefs(bodyEl, draft.body);
    preview.appendChild(bodyEl);
    card.appendChild(preview);

    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;";

    var sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.textContent = "Envoyer";
    sendBtn.style.cssText =
      "padding:6px 14px;border:none;border-radius:8px;background:#22d3ee;" +
      "color:#06283d;font-weight:700;font-size:13px;cursor:pointer;";

    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Modifier dans Inboria";
    editBtn.style.cssText =
      "padding:6px 14px;border:1px solid rgba(34,211,238,.45);border-radius:8px;" +
      "background:transparent;color:#22d3ee;font-weight:600;font-size:13px;cursor:pointer;";

    var status = document.createElement("div");
    status.style.cssText = "font-size:12px;margin-top:6px;";

    sendBtn.onclick = function () { sendDraft(draft, sendBtn, editBtn, status); };
    editBtn.onclick = function () { openDraftInApp(draft); };

    row.appendChild(sendBtn);
    row.appendChild(editBtn);
    card.appendChild(row);
    card.appendChild(status);

    box.appendChild(card);
    box.scrollTop = box.scrollHeight;
  }

  // « Modifier dans Inboria » : ouvre le composeur d'Inboria DÉJÀ pré-rempli
  // (destinataire + objet + corps) avec le brouillon proposé. Le brouillon est
  // transporté dans le fragment d'URL (#inboria-draft=...) : gère les brouillons
  // longs sans stockage serveur et reste hors des journaux serveur.
  function openDraftInApp(draft) {
    var to = "", subject = "", body = "";
    try {
      var item = Office.context && Office.context.mailbox && Office.context.mailbox.item;
      to =
        extractEmail((draft && draft.to) || "") ||
        extractEmail((item && item.from && item.from.emailAddress) || "");
      subject = (draft && draft.subject) || (item && item.subject) || "";
      body = (draft && draft.body) || "";
    } catch (e) {}
    var payload = { to: to, subject: subject, body: body };
    var srcId = draft && draft.sourceEmailId != null ? draft.sourceEmailId : currentEmailId;
    if (srcId) payload.emailId = srcId;

    function openUrl(u) {
      try {
        if (Office.context.ui && Office.context.ui.openBrowserWindow) {
          Office.context.ui.openBrowserWindow(u);
        } else { window.open(u, "_blank"); }
      } catch (e) { window.open(u, "_blank"); }
    }
    var fragmentUrl =
      ORIGIN +
      "/dashboard?from=outlook#inboria-draft=" +
      encodeURIComponent(JSON.stringify(payload));

    // Transport principal : jeton serveur éphémère. openBrowserWindow d'Outlook
    // NE conserve PAS le fragment (#...) → le composeur s'ouvrait vide. La query
    // (?draft=) survit, et le contenu du mail reste hors des journaux serveur.
    // Repli sur le fragment si la création du jeton échoue (hors-ligne / 401).
    apiFetch("/api/inboria/draft-handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.token) {
          openUrl(ORIGIN + "/dashboard?from=outlook&draft=" + encodeURIComponent(data.token));
        } else {
          openUrl(fragmentUrl);
        }
      })
      .catch(function () { openUrl(fragmentUrl); });
  }

  // Extrait une adresse email pure depuis "Nom <email>" ou une chaîne email.
  function extractEmail(s) {
    if (!s) return "";
    var m = String(s).match(/<([^>]+)>/);
    var cand = (m ? m[1] : s).trim();
    var mm = cand.match(/[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/);
    return mm ? mm[0] : "";
  }

  // Envoie le brouillon via Inboria (compte connecté), en réponse à l'expéditeur.
  function sendDraft(draft, btn, editBtn, status) {
    var to = extractEmail(draft.to);
    if (!to) {
      var item = getItem();
      to = extractEmail((item && item.from && item.from.emailAddress) || "");
    }
    if (!to) {
      status.textContent = "⚠️ Destinataire introuvable. Ouvrez le mail puis réessayez.";
      status.style.color = "#f87171";
      return;
    }
    btn.disabled = true;
    btn.textContent = "Envoi…";
    status.textContent = "";
    var payload = {
      to: to,
      subject: draft.subject || "(sans objet)",
      body: draft.body,
    };
    var srcId = draft && draft.sourceEmailId != null ? draft.sourceEmailId : currentEmailId;
    if (srcId) payload.replyToEmailId = srcId;
    apiFetch("/api/emails/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data.error || "Échec de l'envoi.");
          btn.textContent = "✓ Envoyé";
          if (editBtn) editBtn.disabled = true;
          status.textContent = "Réponse envoyée par Inboria.";
          status.style.color = "#34d399";
        });
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = "Envoyer";
        if (/not authenticated|refresh failed|401|invalid or expired token|authentication failed/i.test(String(err && err.message))) {
          clearSession();
          show("login");
          return;
        }
        status.textContent = "⚠️ " + (err && err.message ? err.message : "Erreur.");
        status.style.color = "#f87171";
      });
  }

  // Affiche la réponse : carte brouillon (avec boutons) si présente, sinon texte.
  function renderAssistantReply(raw) {
    var draft = parseDraft(raw);
    if (draft && draft.body) {
      // Fige le mail source au moment de la génération : si l'utilisateur change
      // de mail ensuite, « Envoyer » / « Modifier » resteront sur le bon mail.
      draft.sourceEmailId = currentEmailId;
      renderDraftCard(draft);
      return;
    }
    addMessage("bot", cleanReply(raw) || "(réponse vide)");
  }

  // ---- Office helpers ------------------------------------------------------
  function getItem() {
    try { return Office.context.mailbox.item; } catch (e) { return null; }
  }

  function getBodyText() {
    return new Promise(function (resolve) {
      var item = getItem();
      if (!item || !item.body || !item.body.getAsync) return resolve("");
      try {
        item.body.getAsync("text", function (res) {
          resolve(res && res.status === "succeeded" ? (res.value || "") : "");
        });
      } catch (e) { resolve(""); }
    });
  }

  function getMessageId() {
    var item = getItem();
    return (item && item.internetMessageId) || "";
  }

  // ---- UI: messages --------------------------------------------------------
  // Ouvre un mail précis dans Inboria (depuis un jeton [mail#123] du chat).
  function openMailById(id) {
    var url = ORIGIN + "/dashboard?emailId=" + id + "&from=outlook";
    try {
      if (Office.context.ui && Office.context.ui.openBrowserWindow) {
        Office.context.ui.openBrowserWindow(url);
      } else {
        window.open(url, "_blank");
      }
    } catch (e) {
      window.open(url, "_blank");
    }
  }
  // Petit bouton cliquable « ↗ Ouvrir » (parité avec le chat de l'app Inboria).
  function makeOpenChip(id) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = "↗ Ouvrir";
    b.style.cssText =
      "display:inline-flex;align-items:center;gap:4px;margin:0 3px;padding:2px 9px;" +
      "border:1px solid rgba(34,211,238,.45);background:rgba(34,211,238,.14);" +
      "color:#22d3ee;border-radius:9999px;font-size:12px;line-height:1.4;" +
      "cursor:pointer;font-weight:600;vertical-align:baseline;";
    b.onclick = function () {
      openMailById(id);
    };
    return b;
  }
  // Transforme les jetons [mail#123] du texte en boutons « ↗ Ouvrir ».
  function renderMailRefs(div, text) {
    var re = /\[mail#(\d+)\]/g;
    var last = 0;
    var m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        div.appendChild(document.createTextNode(text.slice(last, m.index)));
      }
      div.appendChild(makeOpenChip(parseInt(m[1], 10)));
      last = m.index + m[0].length;
    }
    if (last < text.length) {
      div.appendChild(document.createTextNode(text.slice(last)));
    }
  }
  function addMessage(role, text) {
    var box = $("messages");
    var div = document.createElement("div");
    div.className = "msg " + (role === "user" ? "user" : "bot");
    if (role === "user") {
      div.textContent = text;
    } else {
      renderMailRefs(div, text || "");
    }
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }
  function addTyping() {
    var box = $("messages");
    var div = document.createElement("div");
    div.className = "msg bot typing";
    div.textContent = "Inboria réfléchit…";
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }

  function sendUserMessage(displayText, payloadText) {
    if (busy) return;
    var msg = (payloadText != null ? payloadText : displayText).trim();
    if (!msg) return;
    busy = true;
    $("sendBtn").disabled = true;
    // Toujours réconcilier le mail courant AVANT d'envoyer : garantit qu'Inboria
    // répond au mail réellement affiché, pas à un mail précédent.
    ensureCurrentEmailId()
      .then(function () {
        addMessage("user", displayText.trim());
        var typing = addTyping();
        return callChat(msg)
          .then(function (reply) {
            typing.remove();
            renderAssistantReply(reply);
          })
          .catch(function (err) {
            typing.remove();
            if (/not authenticated|refresh failed|401/.test(String(err && err.message))) {
              clearSession();
              show("login");
            } else {
              addMessage("bot", "⚠️ " + (err && err.message ? err.message : "Erreur."));
            }
          });
      })
      .finally(function () {
        busy = false;
        $("sendBtn").disabled = false;
      });
  }

  // ---- Quick actions -------------------------------------------------------
  function quickAction(kind) {
    getBodyText().then(function (body) {
      var item = getItem();
      var subject = (item && item.subject) || "(sans objet)";
      var from = (item && item.from && item.from.emailAddress) || "";
      var ctx = "Sujet: " + subject + (from ? "\nDe: " + from : "") + "\n\n" + (body || "").slice(0, 6000);
      var display, payload;
      if (kind === "summarize") {
        display = "Résumer ce mail";
        payload = "Résume ce mail en quelques points clairs :\n\n" + ctx;
      } else if (kind === "reply") {
        display = "Proposer une réponse";
        payload = "Propose une réponse professionnelle et concise à ce mail :\n\n" + ctx;
      } else {
        display = "Que dois-je faire ?";
        payload = "Quelles actions concrètes dois-je prendre suite à ce mail ?\n\n" + ctx;
      }
      sendUserMessage(display, payload);
    });
  }

  // ---- Ouvrir dans Inboria -------------------------------------------------
  function openInApp() {
    var btn = $("openInApp");
    btn.disabled = true;
    var msgId = getMessageId();
    var done = function (url) {
      try {
        if (Office.context.ui && Office.context.ui.openBrowserWindow) {
          Office.context.ui.openBrowserWindow(url);
        } else {
          window.open(url, "_blank");
        }
      } catch (e) { window.open(url, "_blank"); }
      btn.disabled = false;
    };
    if (!msgId) return done(ORIGIN + "/dashboard");
    apiFetch("/api/inboria/resolve-email?providerMessageId=" + encodeURIComponent(msgId))
      .then(function (r) { return r.ok ? r.json() : { emailId: null }; })
      .then(function (data) {
        if (data && data.emailId) {
          currentEmailId = data.emailId;
          done(ORIGIN + "/dashboard?emailId=" + data.emailId + "&from=outlook");
        } else {
          done(ORIGIN + "/dashboard?from=outlook");
        }
      })
      .catch(function () { done(ORIGIN + "/dashboard?from=outlook"); });
  }

  // Réinitialise la conversation (nouveau mail ouvert = nouveau contexte).
  function resetConversation() {
    history = [];
    var box = $("messages");
    if (box) box.innerHTML = "";
    addGreeting();
  }

  // Garantit que currentEmailId correspond TOUJOURS au mail actuellement ouvert
  // dans Outlook. Sans ça, quand le volet reste ouvert d'un mail à l'autre
  // (volet épinglé ou réutilisé par Outlook), l'ancien emailId restait actif et
  // Inboria répondait au MAUVAIS mail (le serveur l'injecte en tête de contexte
  // comme « MAIL ACTUELLEMENT OUVERT À L'ÉCRAN »). Renvoie une promesse.
  function ensureCurrentEmailId() {
    var msgId = getMessageId();
    if (!msgId) {
      // Aucun mail exploitable : on purge pour ne JAMAIS réutiliser un ancien id.
      currentEmailId = null;
      currentEmailMsgId = null;
      return Promise.resolve();
    }
    if (msgId === currentEmailMsgId) return Promise.resolve();
    var hadPrevious = currentEmailMsgId !== null;
    currentEmailMsgId = msgId;
    currentEmailId = null;
    // Changement réel de mail : on repart d'une conversation propre.
    if (hadPrevious) resetConversation();
    return apiFetch(
      "/api/inboria/resolve-email?providerMessageId=" + encodeURIComponent(msgId),
    )
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        // On ne garde l'id que si l'utilisateur n'a pas encore re-changé de mail.
        if (data && data.emailId && getMessageId() === msgId) {
          currentEmailId = data.emailId;
        }
      })
      .catch(function () {});
  }

  // ---- Wiring --------------------------------------------------------------
  function wireChat() {
    $("sendBtn").onclick = function () {
      var inp = $("input");
      var v = inp.value;
      inp.value = "";
      inp.style.height = "auto";
      sendUserMessage(v);
    };
    $("input").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        $("sendBtn").click();
      }
    });
    $("input").addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 110) + "px";
    });
    Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (chip) {
      chip.onclick = function () { quickAction(chip.getAttribute("data-q")); };
    });
    $("openInApp").onclick = openInApp;
    $("clearChatBtn").onclick = function () {
      if (busy) return;
      history = [];
      $("messages").innerHTML = "";
      addGreeting();
    };
    $("logoutBtn").onclick = function () {
      clearSession();
      history = [];
      $("messages").innerHTML = "";
      show("login");
    };
  }

  // Message d'accueil affiché à l'entrée du chat et après « Effacer ».
  function addGreeting() {
    addMessage("bot", "Bonjour 👋 Je suis Inboria. Posez-moi une question sur ce mail, ou utilisez les raccourcis ci-dessus.");
  }

  function enterChat() {
    show("chat");
    if ($("messages").childElementCount === 0) {
      addGreeting();
    }
    ensureCurrentEmailId();
    // Volet épinglé / réutilisé : recharge le contexte quand l'utilisateur
    // passe à un autre mail sans fermer le volet. Enregistré une seule fois.
    if (!itemChangedWired) {
      try {
        if (Office.context && Office.context.mailbox && Office.context.mailbox.addHandlerAsync) {
          Office.context.mailbox.addHandlerAsync(
            Office.EventType.ItemChanged,
            function () { ensureCurrentEmailId(); },
            function (res) {
              // Ne marque « câblé » que si l'enregistrement a réussi (sinon retry
              // au prochain enterChat).
              if (res && res.status === "succeeded") itemChangedWired = true;
            },
          );
        }
      } catch (e) {}
    }
  }

  function wireLogin() {
    $("loginBtn").onclick = function () {
      var email = $("email").value.trim();
      var password = $("password").value;
      var errEl = $("loginErr");
      errEl.textContent = "";
      if (!email || !password) { errEl.textContent = "Email et mot de passe requis."; return; }
      $("loginBtn").disabled = true;
      $("loginBtn").textContent = "Connexion…";
      login(email, password)
        .then(function () { enterChat(); })
        .catch(function (err) { errEl.textContent = err && err.message ? err.message : "Échec de connexion."; })
        .finally(function () {
          $("loginBtn").disabled = false;
          $("loginBtn").textContent = "Se connecter";
        });
    };
    $("password").addEventListener("keydown", function (e) {
      if (e.key === "Enter") $("loginBtn").click();
    });
  }

  function boot() {
    $("brandLogo").src = ORIGIN + "/logo-icon-192.png";
    wireLogin();
    wireChat();
    fetch(ORIGIN + "/api/inboria/addin-config")
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data && data.error ? data.error : "Configuration indisponible.");
          return data;
        });
      })
      .then(function (data) {
        cfg.supabaseUrl = (data.supabaseUrl || "").replace(/\/$/, "");
        cfg.supabaseAnonKey = data.supabaseAnonKey || "";
        loadSession();
        if (session && session.refresh_token) {
          // Valide/rafraîchit la session avant d'afficher le chat.
          getAccessToken().then(function () { enterChat(); }).catch(function () { clearSession(); show("login"); });
        } else {
          show("login");
        }
      })
      .catch(function () {
        show("login");
        $("loginErr").textContent = "Impossible de joindre Inboria. Réessayez.";
      });
  }

  // Office.js prêt → on démarre. Fallback si chargé hors Outlook.
  if (typeof Office !== "undefined" && Office.onReady) {
    Office.onReady(function () { boot(); });
  } else {
    window.addEventListener("DOMContentLoaded", boot);
  }
})();
