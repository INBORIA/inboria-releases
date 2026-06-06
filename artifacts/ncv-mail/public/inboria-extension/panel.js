/* Inboria — panneau de l'extension navigateur (page de l'extension).
 *
 * Réutilise EXACTEMENT le moteur serveur d'Inboria, comme l'add-in Outlook et
 * l'add-on Gmail :
 *  - config publique Supabase via GET /api/inboria/addin-config
 *  - connexion email/mot de passe Supabase (session stockée localement)
 *  - chat via POST /api/inboria/chat (Bearer JWT)
 *  - « Ouvrir dans Inboria » via GET /api/inboria/resolve-email
 *
 * Différence avec l'add-in : le contexte du mail (objet/expéditeur/corps) arrive
 * du script de contenu par postMessage (pas d'Office.js ici).
 */
(function () {
  "use strict";

  // URL publique de l'application Inboria (injectée au téléchargement depuis l'app).
  var INBORIA_BASE = "https://2f7c7417-8ab2-41fb-9fcc-9eddd617f0df-00-5fb1cmje57my.picard.replit.dev";

  var SESSION_KEY = "inboria.ext.session";
  var cfg = { supabaseUrl: "", supabaseAnonKey: "" };
  var session = null;
  var history = [];
  var currentContext = { subject: "", from: "", body: "", messageId: "", nativeId: "" };
  var currentEmailId = null;
  var busy = false;

  function $(id) {
    return document.getElementById(id);
  }
  function show(view) {
    ["loading", "login", "chat"].forEach(function (v) {
      $("view-" + v).classList.toggle("hidden", v !== view);
    });
  }

  // ---- Communication avec le script de contenu ----------------------------
  function post(type, extra) {
    try {
      parent.postMessage(
        Object.assign({ source: "inboria-panel", type: type }, extra || {}),
        "*",
      );
    } catch (e) {}
  }

  window.addEventListener("message", function (ev) {
    // Sécurité : n'accepter que les messages venant de la fenêtre parente
    // (le script de contenu qui héberge cette iframe), pas d'une autre frame.
    if (ev.source !== window.parent) return;
    var d = ev.data;
    if (!d || d.source !== "inboria-content") return;
    if (d.type === "context") {
      currentContext = d.context || currentContext;
      prefetchEmailId();
      updateOpenLabel();
    }
  });

  // Libellé unique demandé par l'utilisateur : « ↗ Ouvrir Inboria » dans tous
  // les cas (qu'un mail soit ouvert ou non dans le webmail). Le comportement
  // sous-jacent reste intelligent : si un mail est détecté et retrouvé dans
  // Inboria, le clic ouvre directement CE mail ; sinon il ouvre la Réception.
  function updateOpenLabel() {
    var b = $("openInApp");
    if (!b) return;
    b.textContent = "↗ Ouvrir Inboria";
  }

  // ---- Session -------------------------------------------------------------
  function loadSession() {
    try {
      var raw = window.localStorage.getItem(SESSION_KEY);
      session = raw ? JSON.parse(raw) : null;
    } catch (e) {
      session = null;
    }
  }
  function saveSession(s) {
    session = s;
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch (e) {}
  }
  function clearSession() {
    session = null;
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
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
      headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey },
      body: JSON.stringify({ email: email, password: password }),
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          throw new Error(
            data.error_description || data.msg || data.error || "Identifiants invalides.",
          );
        }
        storeTokenResponse(data);
        return data;
      });
    });
  }

  function refresh() {
    if (!session || !session.refresh_token)
      return Promise.reject(new Error("no session"));
    return fetch(cfg.supabaseUrl + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    }).then(function (r) {
      if (!r.ok) throw new Error("refresh failed");
      return r.json().then(function (data) {
        storeTokenResponse(data);
        return data;
      });
    });
  }

  function getAccessToken() {
    if (!session) return Promise.reject(new Error("not authenticated"));
    var soon = Date.now() + 60000;
    if (session.expires_at && session.expires_at > soon) {
      return Promise.resolve(session.access_token);
    }
    return refresh().then(function () {
      return session.access_token;
    });
  }

  // ---- API Inboria ---------------------------------------------------------
  function apiFetch(path, options, _retried) {
    return getAccessToken().then(function (token) {
      var opts = options || {};
      opts.headers = Object.assign({}, opts.headers, {
        Authorization: "Bearer " + token,
      });
      return fetch(INBORIA_BASE + path, opts).then(function (r) {
        // Le serveur peut rejeter un jeton que le cache local croyait encore
        // valide (expiré/rotaté côté Supabase). On force alors UN refresh et on
        // rejoue la requête une seule fois ; si le refresh échoue, la session
        // est morte → on remonte « refresh failed » pour déclencher le logout.
        if (r.status === 401 && !_retried) {
          return refresh().then(
            function () {
              return apiFetch(path, options, true);
            },
            function () {
              throw new Error("refresh failed");
            },
          );
        }
        return r;
      });
    });
  }

  // Lit la réponse en JSON de façon tolérante : si le serveur renvoie une page
  // HTML (interstitiel/erreur 502 du proxy, redirection vers une page de
  // connexion…), on ne plante PAS avec « Unexpected token '<' » mais on renvoie
  // une erreur claire (et le signal d'expiration sur 401 pour reconnexion).
  function readJson(r) {
    return r.text().then(function (t) {
      try {
        return JSON.parse(t);
      } catch (e) {
        throw new Error(
          r.status === 401
            ? "invalid or expired token"
            : "Inboria est momentanément indisponible. Réessayez dans un instant.",
        );
      }
    });
  }

  function callChat(message) {
    history.push({ role: "user", content: message });
    var body = {
      messages: history.slice(-20),
      currentRoute: "/browser-extension",
      uiLang: "fr",
    };
    if (currentEmailId) body.currentEmailId = currentEmailId;
    return apiFetch("/api/inboria/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) {
      return readJson(r).then(function (data) {
        if (!r.ok)
          throw new Error(data.error || "Inboria est momentanément indisponible.");
        var reply = cleanReply(data.reply || "");
        history.push({ role: "assistant", content: data.reply || "" });
        return reply;
      });
    });
  }

  function cleanReply(text) {
    if (!text) return "";
    return text
      .replace(/```inboria-draft\s*([\s\S]*?)```/g, function (_m, inner) {
        var b = inner.match(/body:\s*([\s\S]*)/i);
        return b ? "\n" + b[1].trim() : inner.trim();
      })
      .replace(/```[a-z-]*\s*([\s\S]*?)```/g, function (_m, inner) {
        return inner.trim();
      })
      // Ce pont affiche le brouillon / RDV en texte simple (pas de carte ni de
      // boutons Envoyer / Modifier / Bloquer) : on retire la consigne du prompt
      // qui renvoie l'utilisateur vers ces boutons inexistants ici.
      .replace(
        /Cliquez sur [^.]*\b(?:Envoyer|Modifier|Bloquer)\b[^.]*\.(?:\s*(?:Inboria|Le RDV)[^.]*\.)?/gi,
        "",
      )
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // Résout l'id interne Inboria du mail courant (si on a un identifiant).
  function prefetchEmailId() {
    currentEmailId = null;
    var qs = [];
    if (currentContext.messageId)
      qs.push("providerMessageId=" + encodeURIComponent(currentContext.messageId));
    if (currentContext.nativeId)
      qs.push("nativeMessageId=" + encodeURIComponent(currentContext.nativeId));
    if (currentContext.subject)
      qs.push("subject=" + encodeURIComponent(currentContext.subject));
    if (currentContext.from)
      qs.push("from=" + encodeURIComponent(currentContext.from));
    if (!qs.length) return;
    apiFetch("/api/inboria/resolve-email?" + qs.join("&"))
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (data && data.emailId) currentEmailId = data.emailId;
      })
      .catch(function () {});
  }

  // ---- Messages UI ---------------------------------------------------------
  // Ouvre un mail précis dans Inboria (depuis un jeton [mail#123] du chat).
  function openMailById(id) {
    post("open", {
      url: INBORIA_BASE + "/dashboard?emailId=" + id + "&from=extension",
    });
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
        if (
          /not authenticated|refresh failed|401|invalid or expired token|authentication failed/i.test(
            String(err && err.message),
          )
        ) {
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

  // ---- Actions rapides -----------------------------------------------------
  function hasMailContext() {
    return Boolean(
      (currentContext.body && currentContext.body.length > 10) ||
        (currentContext.subject && currentContext.subject.length > 2),
    );
  }

  function quickAction(kind) {
    if (!hasMailContext()) {
      addMessage(
        "bot",
        "Ouvrez d'abord un mail dans votre webmail (ou sélectionnez le texte du message), puis réessayez.",
      );
      return;
    }
    var subject = currentContext.subject || "(sans objet)";
    var from = currentContext.from || "";
    var ctx =
      "Sujet: " +
      subject +
      (from ? "\nDe: " + from : "") +
      "\n\n" +
      (currentContext.body || "").slice(0, 6000);
    var display, payload;
    if (kind === "reply") {
      display = "Proposer une réponse";
      payload = "Propose une réponse professionnelle et concise à ce mail :\n\n" + ctx;
    } else if (kind === "todo") {
      display = "Que dois-je faire ?";
      payload = "Quelles actions concrètes dois-je prendre suite à ce mail ?\n\n" + ctx;
    } else {
      display = "Résumer ce mail";
      payload = "Résume ce mail en quelques points clairs :\n\n" + ctx;
    }
    sendUserMessage(display, payload);
  }

  // ---- Ouvrir dans Inboria -------------------------------------------------
  function openInApp() {
    var done = function (url) {
      post("open", { url: url });
    };
    var qs = [];
    if (currentContext.messageId)
      qs.push("providerMessageId=" + encodeURIComponent(currentContext.messageId));
    if (currentContext.nativeId)
      qs.push("nativeMessageId=" + encodeURIComponent(currentContext.nativeId));
    // Repli universel (OWA/OVH, Roundcube…) : sujet + expéditeur grattés.
    if (currentContext.subject)
      qs.push("subject=" + encodeURIComponent(currentContext.subject));
    if (currentContext.from)
      qs.push("from=" + encodeURIComponent(currentContext.from));
    if (!qs.length) return done(INBORIA_BASE + "/dashboard?from=extension");
    // URL de repli : on transmet les identifiants BRUTS à l'app web (préfixe x*
    // pour ne pas entrer en collision avec le marqueur `from=extension`). L'app,
    // authentifiée par sa propre session, résout alors le mail elle-même — fiable
    // même si le jeton de l'extension est expiré (résolution ici → 401).
    var xqs = [];
    if (currentContext.messageId)
      xqs.push("xmid=" + encodeURIComponent(currentContext.messageId));
    if (currentContext.nativeId)
      xqs.push("xnid=" + encodeURIComponent(currentContext.nativeId));
    if (currentContext.subject)
      xqs.push("xsubject=" + encodeURIComponent(currentContext.subject));
    if (currentContext.from)
      xqs.push("xfrom=" + encodeURIComponent(currentContext.from));
    var rawUrl =
      INBORIA_BASE +
      "/dashboard?from=extension" +
      (xqs.length ? "&" + xqs.join("&") : "");
    apiFetch("/api/inboria/resolve-email?" + qs.join("&"))
      .then(function (r) {
        return r.ok ? r.json() : { emailId: null };
      })
      .then(function (data) {
        if (data && data.emailId) {
          currentEmailId = data.emailId;
          done(INBORIA_BASE + "/dashboard?emailId=" + data.emailId + "&from=extension");
        } else {
          done(rawUrl);
        }
      })
      .catch(function () {
        done(rawUrl);
      });
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
    Array.prototype.forEach.call(document.querySelectorAll(".chip[data-q]"), function (chip) {
      chip.onclick = function () {
        quickAction(chip.getAttribute("data-q"));
      };
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

  // Message d'accueil affiché à l'entrée du chat et après « Effacer la conversation ».
  function addGreeting() {
    addMessage(
      "bot",
      "Bonjour 👋 Je suis Inboria. Ouvrez un mail puis utilisez les raccourcis ci-dessus, ou posez-moi directement votre question.",
    );
  }

  function wireLogin() {
    $("loginBtn").onclick = function () {
      var email = $("email").value.trim();
      var password = $("password").value;
      var errEl = $("loginErr");
      errEl.textContent = "";
      if (!email || !password) {
        errEl.textContent = "Email et mot de passe requis.";
        return;
      }
      $("loginBtn").disabled = true;
      $("loginBtn").textContent = "Connexion…";
      login(email, password)
        .then(function () {
          enterChat();
        })
        .catch(function (err) {
          errEl.textContent = err && err.message ? err.message : "Échec de connexion.";
        })
        .finally(function () {
          $("loginBtn").disabled = false;
          $("loginBtn").textContent = "Se connecter";
        });
    };
    $("password").addEventListener("keydown", function (e) {
      if (e.key === "Enter") $("loginBtn").click();
    });
  }

  function enterChat() {
    show("chat");
    updateOpenLabel();
    if (session && session.email) $("userEmail").textContent = "Connecté : " + session.email;
    if ($("messages").childElementCount === 0) {
      addGreeting();
    }
    post("request-context");
  }

  function boot() {
    wireLogin();
    wireChat();
    $("closeBtn").onclick = function () {
      post("close");
    };
    // Filet de sécurité : la touche Échap ferme aussi le panneau.
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" || e.key === "Esc") post("close");
    });
    post("ready");
    fetch(INBORIA_BASE + "/api/inboria/addin-config")
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok)
            throw new Error(data && data.error ? data.error : "Configuration indisponible.");
          return data;
        });
      })
      .then(function (data) {
        cfg.supabaseUrl = (data.supabaseUrl || "").replace(/\/$/, "");
        cfg.supabaseAnonKey = data.supabaseAnonKey || "";
        loadSession();
        if (session && session.refresh_token) {
          getAccessToken()
            .then(function () {
              enterChat();
            })
            .catch(function () {
              clearSession();
              show("login");
            });
        } else {
          show("login");
        }
      })
      .catch(function () {
        show("login");
        $("loginErr").textContent = "Impossible de joindre Inboria. Réessayez.";
      });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
