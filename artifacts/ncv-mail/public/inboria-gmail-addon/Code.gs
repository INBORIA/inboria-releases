/**
 * Inboria — module complémentaire Gmail (« Demander à Inboria »).
 *
 * À copier dans un projet Google Apps Script (script.google.com).
 * Réutilise l'IA et l'authentification d'Inboria :
 *  - config Supabase via GET /api/inboria/addin-config
 *  - connexion email/mot de passe Supabase, session stockée par utilisateur
 *  - chat via POST /api/inboria/chat (Bearer JWT)
 *  - « Ouvrir dans Inboria » : résout le Message-ID -> id interne et ouvre l'app
 *
 * Une seule valeur à vérifier : INBORIA_BASE (URL publique de votre Inboria).
 */

// URL publique de l'application Inboria (injectée au téléchargement depuis l'app).
var INBORIA_BASE = "__INBORIA_BASE__";

var SESSION_PROP = "inboria.session";
var _cfg = null; // { supabaseUrl, supabaseAnonKey }

// ---------------------------------------------------------------------------
// Config publique (Supabase)
// ---------------------------------------------------------------------------
function getConfig_() {
  if (_cfg) return _cfg;
  var resp = UrlFetchApp.fetch(INBORIA_BASE + "/api/inboria/addin-config", {
    method: "get",
    muteHttpExceptions: true,
  });
  if (resp.getResponseCode() !== 200) {
    throw new Error("Configuration Inboria indisponible.");
  }
  var data = JSON.parse(resp.getContentText() || "{}");
  _cfg = {
    supabaseUrl: String(data.supabaseUrl || "").replace(/\/+$/, ""),
    supabaseAnonKey: String(data.supabaseAnonKey || ""),
  };
  return _cfg;
}

// ---------------------------------------------------------------------------
// Session (par utilisateur)
// ---------------------------------------------------------------------------
function props_() {
  return PropertiesService.getUserProperties();
}

function getSession_() {
  var raw = props_().getProperty(SESSION_PROP);
  return raw ? JSON.parse(raw) : null;
}

function saveSession_(s) {
  props_().setProperty(SESSION_PROP, JSON.stringify(s));
}

function clearSession_() {
  props_().deleteProperty(SESSION_PROP);
}

function storeToken_(data) {
  var prev = getSession_() || {};
  var expiresAt = data.expires_at
    ? data.expires_at * 1000
    : Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600000);
  saveSession_({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
    email: (data.user && data.user.email) || prev.email || "",
  });
}

function login_(email, password) {
  var cfg = getConfig_();
  var resp = UrlFetchApp.fetch(
    cfg.supabaseUrl + "/auth/v1/token?grant_type=password",
    {
      method: "post",
      contentType: "application/json",
      headers: { apikey: cfg.supabaseAnonKey },
      payload: JSON.stringify({ email: email, password: password }),
      muteHttpExceptions: true,
    }
  );
  var data = JSON.parse(resp.getContentText() || "{}");
  if (resp.getResponseCode() !== 200) {
    throw new Error(
      data.error_description || data.msg || data.error || "Identifiants invalides."
    );
  }
  storeToken_(data);
}

function refresh_() {
  var s = getSession_();
  if (!s || !s.refresh_token) throw new Error("not authenticated");
  var cfg = getConfig_();
  var resp = UrlFetchApp.fetch(
    cfg.supabaseUrl + "/auth/v1/token?grant_type=refresh_token",
    {
      method: "post",
      contentType: "application/json",
      headers: { apikey: cfg.supabaseAnonKey },
      payload: JSON.stringify({ refresh_token: s.refresh_token }),
      muteHttpExceptions: true,
    }
  );
  if (resp.getResponseCode() !== 200) throw new Error("refresh failed");
  storeToken_(JSON.parse(resp.getContentText() || "{}"));
}

function getAccessToken_() {
  var s = getSession_();
  if (!s) throw new Error("not authenticated");
  if (s.expires_at && s.expires_at > Date.now() + 60000) return s.access_token;
  refresh_();
  return getSession_().access_token;
}

// ---------------------------------------------------------------------------
// API Inboria
// ---------------------------------------------------------------------------
function apiFetch_(path, options) {
  var token = getAccessToken_();
  var opts = options || {};
  opts.muteHttpExceptions = true;
  opts.headers = opts.headers || {};
  opts.headers.Authorization = "Bearer " + token;
  var resp = UrlFetchApp.fetch(INBORIA_BASE + path, opts);
  var code = resp.getResponseCode();
  var text = resp.getContentText() || "";
  if (code === 401) throw new Error("401");
  var data = text ? JSON.parse(text) : {};
  if (code >= 400) {
    throw new Error(data.error || "Inboria est momentanément indisponible.");
  }
  return data;
}

// Déduit la langue de l'interface Gmail (ex. "fr-FR" -> "fr"), repli "fr".
function uiLang_(e) {
  try {
    var loc = e && e.commonEventObject && e.commonEventObject.userLocale;
    if (loc) return String(loc).split("-")[0].toLowerCase();
  } catch (x) {}
  return "fr";
}

function callChat_(message, emailId, lang) {
  var body = {
    messages: [{ role: "user", content: message }],
    currentRoute: "/gmail-addon",
    uiLang: lang || "fr",
  };
  if (emailId) body.currentEmailId = emailId;
  var data = apiFetch_("/api/inboria/chat", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(body),
  });
  return data.reply || "";
}

// Résout l'id interne Inboria du mail courant. On envoie l'ID natif Gmail
// (e.gmail.messageId — toujours disponible, AUCUN appel API supplémentaire)
// ET, en bonus, le Message-ID RFC822 si on arrive à le lire. Le backend
// matche en priorité l'ID natif (external_id = "gmail:<id>").
function resolveEmailId_(e) {
  var nativeId = e && e.gmail && e.gmail.messageId ? e.gmail.messageId : "";
  var rfcId = getHeader_(e, "Message-ID");
  if (!nativeId && !rfcId) return null;
  try {
    var qs = [];
    if (nativeId) qs.push("nativeMessageId=" + encodeURIComponent(nativeId));
    if (rfcId) qs.push("providerMessageId=" + encodeURIComponent(rfcId));
    var data = apiFetch_("/api/inboria/resolve-email?" + qs.join("&"), {
      method: "get",
    });
    return data && data.emailId ? data.emailId : null;
  } catch (e2) {
    return null;
  }
}

// Transforme les blocs ```inboria-draft``` / ``` en texte lisible (cas SANS carte).
function cleanReply_(text) {
  if (!text) return "";
  return text
    .replace(/```inboria-draft\s*([\s\S]*?)```/g, function (_m, inner) {
      return "\n" + extractDraftBody_(inner);
    })
    .replace(/```[a-z-]*\s*([\s\S]*?)```/g, function (_m, inner) {
      return inner.trim();
    })
    // Les blocs RDV restent en texte simple (pas de carte) : on retire la
    // consigne du prompt qui renvoie vers des boutons inexistants ici.
    .replace(
      /Cliquez sur [^.]*\b(?:Envoyer|Modifier|Bloquer)\b[^.]*\.(?:\s*(?:Inboria|Le RDV)[^.]*\.)?/gi,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Extrait proprement le corps d'un bloc inboria-draft (gère "body: |" + indentation).
function extractDraftBody_(inner) {
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
    .map(function (l) {
      return l.slice(min);
    })
    .join("\n")
    .trim();
}

// Repère un brouillon de réponse et en extrait to / subject / body + intro.
function parseDraft_(raw) {
  if (!raw) return null;
  var m = raw.match(/```inboria-draft\s*([\s\S]*?)```/);
  if (!m) return null;
  var inner = m[1];
  var to = (inner.match(/^[ \t]*to:\s*(.+)$/im) || [])[1] || "";
  var subject = (inner.match(/^[ \t]*subject:\s*(.+)$/im) || [])[1] || "";
  var body = extractDraftBody_(inner);
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

// ---------------------------------------------------------------------------
// Lecture du mail courant
// ---------------------------------------------------------------------------
function getCurrentMessage_(e) {
  if (!e || !e.gmail || !e.gmail.messageId) return null;
  GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
  return GmailApp.getMessageById(e.gmail.messageId);
}

// Récupère un en-tête brut du mail courant via l'API Gmail (jeton du module).
function getHeader_(e, name) {
  try {
    if (!e || !e.gmail || !e.gmail.messageId) return "";
    var url =
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/" +
      e.gmail.messageId +
      "?format=metadata&metadataHeaders=" +
      encodeURIComponent(name);
    var resp = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { Authorization: "Bearer " + e.gmail.accessToken },
      muteHttpExceptions: true,
    });
    if (resp.getResponseCode() !== 200) return "";
    var data = JSON.parse(resp.getContentText() || "{}");
    var headers = (data.payload && data.payload.headers) || [];
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i].name).toLowerCase() === name.toLowerCase()) {
        return headers[i].value || "";
      }
    }
    return "";
  } catch (err) {
    return "";
  }
}

function buildContext_(e) {
  var msg = getCurrentMessage_(e);
  if (!msg) return "";
  var subject = msg.getSubject() || "(sans objet)";
  var from = msg.getFrom() || "";
  var body = "";
  try {
    body = msg.getPlainBody() || "";
  } catch (x) {
    body = "";
  }
  return (
    "Sujet: " +
    subject +
    (from ? "\nDe: " + from : "") +
    "\n\n" +
    body.slice(0, 6000)
  );
}

// ---------------------------------------------------------------------------
// UI — cartes
// ---------------------------------------------------------------------------
function onHomepage(e) {
  return getSession_() ? buildAskCard_(e, null) : buildLoginCard_(null);
}

function onGmailMessage(e) {
  return getSession_() ? buildMessageCard_(e, null) : buildLoginCard_(null);
}

function buildLoginCard_(errorText) {
  var section = CardService.newCardSection();
  section.addWidget(
    CardService.newTextParagraph().setText(
      "Connectez-vous avec votre compte Inboria pour utiliser l'assistant dans Gmail."
    )
  );
  section.addWidget(
    CardService.newTextInput().setFieldName("email").setTitle("Adresse email")
  );
  section.addWidget(
    CardService.newTextInput()
      .setFieldName("password")
      .setTitle("Mot de passe")
      .setHint("Saisi une seule fois, conservé de façon sécurisée par Google.")
  );
  if (errorText) {
    section.addWidget(
      CardService.newTextParagraph().setText(
        '<font color="#f87171">' + escapeHtml_(errorText) + "</font>"
      )
    );
  }
  section.addWidget(
    CardService.newTextButton()
      .setText("Se connecter")
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(CardService.newAction().setFunctionName("handleLogin_"))
  );
  return baseCard_("Demander à Inboria").addSection(section).build();
}

function handleLogin_(e) {
  var inputs = (e && e.formInputs) || {};
  var email =
    inputs.email && inputs.email[0] ? String(inputs.email[0]).trim() : "";
  var password =
    inputs.password && inputs.password[0] ? String(inputs.password[0]) : "";
  if (!email || !password) {
    return navTo_(buildLoginCard_("Email et mot de passe requis."));
  }
  try {
    login_(email, password);
  } catch (err) {
    return navTo_(
      buildLoginCard_(err && err.message ? err.message : "Échec de connexion.")
    );
  }
  var card =
    e && e.gmail && e.gmail.messageId
      ? buildMessageCard_(e, null)
      : buildAskCard_(e, null);
  return navTo_(card);
}

function buildMessageCard_(e, answer, draft) {
  var card = baseCard_("Demander à Inboria");
  var quick = CardService.newCardSection();
  quick.addWidget(
    CardService.newTextButton()
      .setText("Résumer ce mail")
      .setOnClickAction(actionWithKind_("summarize"))
  );
  quick.addWidget(
    CardService.newTextButton()
      .setText("Proposer une réponse")
      .setOnClickAction(actionWithKind_("reply"))
  );
  quick.addWidget(
    CardService.newTextButton()
      .setText("Que dois-je faire ?")
      .setOnClickAction(actionWithKind_("todo"))
  );
  quick.addWidget(
    CardService.newTextButton()
      .setText("↗ Ouvrir dans Inboria")
      .setOnClickAction(CardService.newAction().setFunctionName("handleOpen_"))
  );
  card.addSection(quick);

  if (draft && draft.body) {
    card.addSection(draftSection_(draft));
  } else if (answer) {
    card.addSection(
      CardService.newCardSection()
        .setHeader("Inboria")
        .addWidget(CardService.newTextParagraph().setText(formatReply_(answer)))
    );
  }

  card.addSection(askSection_());
  card.addSection(footerSection_());
  return card.build();
}

function buildAskCard_(e, answer, draft) {
  var card = baseCard_("Demander à Inboria");
  var intro = CardService.newCardSection();
  intro.addWidget(
    CardService.newTextParagraph().setText(
      "Ouvrez un mail pour les actions rapides, ou posez directement votre question ci-dessous."
    )
  );
  intro.addWidget(
    CardService.newTextButton()
      .setText("↗ Ouvrir Inboria")
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(CardService.newAction().setFunctionName("handleOpen_"))
  );
  card.addSection(intro);
  if (draft && draft.body) {
    card.addSection(draftSection_(draft));
  } else if (answer) {
    card.addSection(
      CardService.newCardSection()
        .setHeader("Inboria")
        .addWidget(CardService.newTextParagraph().setText(formatReply_(answer)))
    );
  }
  card.addSection(askSection_());
  card.addSection(footerSection_());
  return card.build();
}

function askSection_() {
  var s = CardService.newCardSection();
  s.addWidget(
    CardService.newTextInput()
      .setFieldName("question")
      .setTitle("Votre question")
      .setHint("Ex. : Résume ce fil, rédige une relance polie…")
  );
  s.addWidget(
    CardService.newTextButton()
      .setText("Envoyer")
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(CardService.newAction().setFunctionName("handleAsk_"))
  );
  return s;
}

function footerSection_() {
  var s = CardService.newCardSection();
  var sess = getSession_();
  if (sess && sess.email) {
    s.addWidget(
      CardService.newTextParagraph().setText(
        '<font color="#93a1b9">Connecté : ' + escapeHtml_(sess.email) + "</font>"
      )
    );
  }
  s.addWidget(
    CardService.newTextButton()
      .setText("Déconnexion")
      .setOnClickAction(CardService.newAction().setFunctionName("handleLogout_"))
  );
  return s;
}

function actionWithKind_(kind) {
  return CardService.newAction()
    .setFunctionName("handleQuick_")
    .setParameters({ kind: kind });
}

function handleAsk_(e) {
  var inputs = (e && e.formInputs) || {};
  var q =
    inputs.question && inputs.question[0]
      ? String(inputs.question[0]).trim()
      : "";
  if (!q) {
    return notify_("Saisissez d'abord une question.");
  }
  return runChat_(e, q);
}

function handleQuick_(e) {
  var kind =
    e && e.parameters && e.parameters.kind ? e.parameters.kind : "summarize";
  var ctx = buildContext_(e);
  var payload;
  if (kind === "reply") {
    payload =
      "Propose une réponse professionnelle et concise à ce mail :\n\n" + ctx;
  } else if (kind === "todo") {
    payload =
      "Quelles actions concrètes dois-je prendre suite à ce mail ?\n\n" + ctx;
  } else {
    payload = "Résume ce mail en quelques points clairs :\n\n" + ctx;
  }
  return runChat_(e, payload);
}

function runChat_(e, payload) {
  try {
    var emailId = resolveEmailId_(e);
    var raw = callChat_(payload, emailId, uiLang_(e));
    var draft = parseDraft_(raw);
    var hasMsg = e && e.gmail && e.gmail.messageId;
    var card;
    if (draft && draft.body) {
      card = hasMsg
        ? buildMessageCard_(e, null, draft)
        : buildAskCard_(e, null, draft);
    } else {
      var answer = cleanReply_(raw) || "(réponse vide)";
      card = hasMsg
        ? buildMessageCard_(e, answer, null)
        : buildAskCard_(e, answer, null);
    }
    return navUpdate_(card);
  } catch (err) {
    var m = String(err && err.message);
    if (m.indexOf("401") >= 0 || m.indexOf("authenticated") >= 0) {
      clearSession_();
      return navUpdate_(buildLoginCard_("Session expirée. Reconnectez-vous."));
    }
    return notify_(err && err.message ? err.message : "Erreur Inboria.");
  }
}

function handleOpen_(e) {
  var p = (e && e.parameters) || {};
  var emailId = resolveEmailId_(e);
  // « Modifier dans Inboria » sur un brouillon : ouvre le composeur DÉJÀ
  // pré-rempli (destinataire + objet + corps) en transportant le brouillon dans
  // le fragment d'URL (#inboria-draft=...) — gère les brouillons longs sans
  // stockage serveur et reste hors des journaux serveur.
  if (p.draftBody || p.draftSubject || p.draftTo) {
    var payload = {
      to: p.draftTo || "",
      subject: p.draftSubject || "",
      body: p.draftBody || "",
    };
    if (emailId) payload.emailId = emailId;
    var durl =
      INBORIA_BASE +
      "/dashboard?from=gmail#inboria-draft=" +
      encodeURIComponent(JSON.stringify(payload));
    return CardService.newActionResponseBuilder()
      .setOpenLink(CardService.newOpenLink().setUrl(durl))
      .build();
  }
  var url = emailId
    ? INBORIA_BASE + "/dashboard?emailId=" + emailId + "&from=gmail"
    : INBORIA_BASE + "/dashboard?from=gmail";
  return CardService.newActionResponseBuilder()
    .setOpenLink(CardService.newOpenLink().setUrl(url))
    .build();
}

// Section carte d'un brouillon : aperçu + boutons « Envoyer » / « Modifier ».
function draftSection_(draft) {
  var s = CardService.newCardSection().setHeader("Brouillon Inboria");
  if (draft.intro) {
    s.addWidget(
      CardService.newTextParagraph().setText(formatReply_(draft.intro))
    );
  }
  if (draft.subject) {
    s.addWidget(
      CardService.newTextParagraph().setText(
        "<b>Objet :</b> " + escapeHtml_(draft.subject)
      )
    );
  }
  s.addWidget(CardService.newTextParagraph().setText(formatReply_(draft.body)));
  s.addWidget(
    CardService.newTextButton()
      .setText("Envoyer")
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName("handleSendDraft_")
          .setParameters({
            to: draft.to || "",
            subject: draft.subject || "",
            body: draft.body || "",
          })
      )
  );
  s.addWidget(
    CardService.newTextButton()
      .setText("Modifier dans Inboria")
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName("handleOpen_")
          .setParameters({
            draftTo: draft.to || "",
            draftSubject: draft.subject || "",
            draftBody: draft.body || "",
          })
      )
  );
  return s;
}

// Envoie le brouillon via Inboria (compte connecté), en réponse à l'expéditeur.
function handleSendDraft_(e) {
  var p = (e && e.parameters) || {};
  var to = p.to || "";
  if (!to) {
    var msg = getCurrentMessage_(e);
    if (msg) {
      var from = msg.getFrom() || "";
      var mm = from.match(/<([^>]+)>/);
      to = mm ? mm[1] : from;
    }
  }
  if (!to) {
    return notify_("Destinataire introuvable. Ouvrez le mail puis réessayez.");
  }
  try {
    var emailId = resolveEmailId_(e);
    var payload = {
      to: to,
      subject: p.subject || "(sans objet)",
      body: p.body || "",
    };
    if (emailId) payload.replyToEmailId = emailId;
    apiFetch_("/api/emails/send", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
    });
    return notify_("Réponse envoyée par Inboria.");
  } catch (err) {
    var m = String(err && err.message);
    if (m.indexOf("401") >= 0 || m.indexOf("authenticated") >= 0) {
      clearSession_();
      return navUpdate_(buildLoginCard_("Session expirée. Reconnectez-vous."));
    }
    return notify_(err && err.message ? err.message : "Échec de l'envoi.");
  }
}

function handleLogout_(e) {
  clearSession_();
  return navUpdate_(buildLoginCard_(null));
}

// ---------------------------------------------------------------------------
// Helpers UI
// ---------------------------------------------------------------------------
function baseCard_(title) {
  return CardService.newCardBuilder().setHeader(
    CardService.newCardHeader().setTitle(title)
  );
}

function navTo_(card) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(card))
    .build();
}

function navUpdate_(card) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(card))
    .build();
}

function notify_(text) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(text))
    .build();
}

function escapeHtml_(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatReply_(s) {
  return escapeHtml_(s).replace(/\n/g, "<br>");
}
