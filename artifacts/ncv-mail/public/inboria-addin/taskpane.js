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
        var reply = cleanReply(data.reply || "");
        history.push({ role: "assistant", content: data.reply || "" });
        return reply;
      });
    });
  }

  // Transforme les blocs ```inboria-draft / yaml en texte lisible.
  function cleanReply(text) {
    if (!text) return "";
    return text
      .replace(/```inboria-draft\s*([\s\S]*?)```/g, function (_m, inner) {
        var bodyMatch = inner.match(/body:\s*([\s\S]*)/i);
        return bodyMatch ? "\n" + bodyMatch[1].trim() : inner.trim();
      })
      .replace(/```[a-z-]*\s*([\s\S]*?)```/g, function (_m, inner) { return inner.trim(); })
      .trim();
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
    addMessage("user", displayText.trim());
    var typing = addTyping();
    callChat(msg)
      .then(function (reply) {
        typing.remove();
        addMessage("bot", reply || "(réponse vide)");
      })
      .catch(function (err) {
        typing.remove();
        if (/not authenticated|refresh failed|401/.test(String(err && err.message))) {
          clearSession();
          show("login");
        } else {
          addMessage("bot", "⚠️ " + (err && err.message ? err.message : "Erreur."));
        }
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

  // Tente de résoudre l'emailId courant en arrière-plan (contexte chat).
  function prefetchEmailId() {
    var msgId = getMessageId();
    if (!msgId) return;
    apiFetch("/api/inboria/resolve-email?providerMessageId=" + encodeURIComponent(msgId))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { if (data && data.emailId) currentEmailId = data.emailId; })
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
    prefetchEmailId();
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
