import { Router, type IRouter } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { recordAutopilotEvent } from "../services/autopilot-events";
import { emitWebhook } from "../services/webhooks";
import {
  pushAppointmentToProvider,
  patchAppointmentOnProvider,
  deleteAppointmentOnProvider,
  pullExternalEventsAndUpsert,
  generateJitsiUrl,
  type AppointmentPushPayload,
  type VideoProvider,
} from "../services/calendar-sync";
import { proposeMeeting, proposeMeetingMulti, sendCounterAcceptedEmail, sendCounterDeclinedEmail, holdMeeting, holdMeetingMulti, replayTransactionalConfirmsForUser, sendProposalForExistingAppointment } from "../services/meeting-proposals";
import {
  proposeMultiMeeting,
  findMultiCommonSlots,
  remindParticipant,
  updateParticipantStatus,
} from "../services/multi-meeting";
import { createNotification, getOrgIdForUser, getUserName } from "../lib/activity";

const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "must be an ISO 8601 date-time");

const participantsSchema = z
  .string()
  .max(2000)
  .refine(
    (v) =>
      v
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
    "participants must be a list of valid email addresses",
  );

const videoProviderSchema = z.enum(["meet", "teams", "jitsi", "none"]);

const createAppointmentSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  startAt: isoDateTime,
  endAt: isoDateTime,
  allDay: z.boolean().optional(),
  emailId: z.union([z.number().int(), z.string()]).optional().nullable(),
  projectId: z.union([z.number().int(), z.string()]).optional().nullable(),
  reminderMinutes: z.number().int().min(0).max(10080).optional(),
  participants: participantsSchema.optional().nullable(),
  calendarAccountId: z.string().uuid().optional().nullable(),
  videoProvider: videoProviderSchema.optional().nullable(),
  videoUrl: z.string().url().max(2000).optional().nullable(),
  internal: z.boolean().optional(),
  status: z.enum(["confirmed", "pending"]).optional(),
  internalNote: z.object({
    body: z.string().trim().min(1).max(4000),
    recipientUserIds: z.array(z.string().uuid()).max(50).optional(),
  }).optional().nullable(),
}).refine((b) => Date.parse(b.endAt) >= Date.parse(b.startAt), {
  message: "endAt must be after startAt",
  path: ["endAt"],
});

const updateAppointmentSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  startAt: isoDateTime.optional(),
  endAt: isoDateTime.optional(),
  allDay: z.boolean().optional(),
  emailId: z.union([z.number().int(), z.string()]).optional().nullable(),
  projectId: z.union([z.number().int(), z.string()]).optional().nullable(),
  reminderMinutes: z.number().int().min(0).max(10080).optional(),
  confirmed: z.boolean().optional(),
  status: z.enum(["confirmed", "pending", "declined", "counter_proposed", "cancelled"]).optional(),
  participants: participantsSchema.optional().nullable(),
  calendarAccountId: z.string().uuid().optional().nullable(),
  videoProvider: videoProviderSchema.optional().nullable(),
  videoUrl: z.string().url().max(2000).optional().nullable(),
  internal: z.boolean().optional(),
});

const router: IRouter = Router();

function mapAppointment(row: any) {
  if (!row) return row;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    location: row.location,
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: row.all_day,
    emailId: row.email_id,
    projectId: row.project_id,
    reminderMinutes: row.reminder_minutes,
    confirmed: row.confirmed ?? true,
    participants: row.participants,
    calendarAccountId: row.calendar_account_id ?? null,
    externalProvider: row.external_provider ?? null,
    externalId: row.external_id ?? null,
    externalCalendarId: row.external_calendar_id ?? null,
    organizerEmail: row.organizer_email ?? null,
    lastSyncedAt: row.last_synced_at ?? null,
    lastSyncError: row.last_sync_error ?? null,
    status: row.status ?? "confirmed",
    proposalMessageId: row.proposal_message_id ?? null,
    proposalGroupId: row.proposal_group_id ?? null,
    responseMessageId: row.response_message_id ?? null,
    awaitingReminderAt: row.awaiting_reminder_at ?? null,
    reminderSentAt: row.reminder_sent_at ?? null,
    counterStartAt: row.counter_start_at ?? null,
    counterEndAt: row.counter_end_at ?? null,
    proposalRecipient: row.proposal_recipient ?? null,
    proposalLang: row.proposal_lang ?? null,
    videoProvider: row.video_provider ?? null,
    videoUrl: row.video_url ?? null,
    videoJoinUrl: row.video_join_url ?? null,
    internal: row.internal ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    projects: row.projects,
  };
}

function buildPushPayload(row: any): AppointmentPushPayload {
  return {
    title: row.title,
    description: row.description,
    location: row.location,
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: row.all_day,
    participants: row.participants,
    videoProvider: (row.video_provider as VideoProvider | null) ?? null,
    videoUrl: row.video_url ?? null,
  };
}

/**
 * Résout le fournisseur visio effectif pour un RDV : si Meet/Teams est demandé
 * mais que le calendrier de destination ne le supporte pas (ou est absent), on
 * retombe automatiquement sur Jitsi pour garantir qu'un lien visio est toujours
 * présent (objectif Phase 4 : "ajouter automatiquement un lien à tout RDV").
 * Si l'appelant n'a rien demandé, on utilise la préférence utilisateur, avec
 * Jitsi comme défaut final.
 */
async function resolveEffectiveVideoProvider(
  userId: string,
  requested: VideoProvider | null | undefined,
  calendarAccountId: string | null | undefined,
): Promise<VideoProvider> {
  let chosen: VideoProvider;
  if (requested === undefined || requested === null) {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("preferred_video_provider")
      .eq("id", userId)
      .maybeSingle();
    const pref = (prof as { preferred_video_provider?: string | null } | null)?.preferred_video_provider;
    // Si l'utilisateur n'a pas explicitement choisi, on garantit un lien (Jitsi)
    // — une préférence "none" en base ne doit pas implicitement désactiver la
    // visio quand le client n'a rien demandé.
    chosen = pref && pref !== "none" ? (pref as VideoProvider) : "jitsi";
  } else {
    chosen = requested;
  }
  if (chosen === "none" || chosen === "jitsi") return chosen;
  // Meet/Teams require a matching calendar — fall back to Jitsi otherwise.
  if (!calendarAccountId) return "jitsi";
  const { data: acc } = await supabaseAdmin
    .from("calendar_accounts")
    .select("provider")
    .eq("id", calendarAccountId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!acc) return "jitsi";
  if (chosen === "meet" && acc.provider !== "google") return "jitsi";
  if (chosen === "teams" && acc.provider !== "outlook") return "jitsi";
  return chosen;
}

router.get("/appointments", requireAuth, async (req, res): Promise<void> => {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const projectId = req.query.projectId as string | undefined;

    let query = supabaseAdmin
      .from("appointments")
      .select("*, projects(id, name, reference, color)")
      .eq("user_id", req.userId!)
      .neq("status", "cancelled")
      .order("start_at", { ascending: true });

    if (from) {
      query = query.gte("start_at", from);
    }
    if (to) {
      query = query.lte("start_at", to);
    }
    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json((data || []).map(mapAppointment));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/appointments/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select("*, projects(id, name, reference, color)")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .single();

    if (error) { res.status(404).json({ error: "Appointment not found" }); return; }
    res.json(mapAppointment(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/appointments", requireAuth, async (req, res): Promise<void> => {
  try {
    const parsed = createAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }
    const {
      title, description, location, startAt, endAt, allDay, emailId, projectId,
      reminderMinutes, participants, calendarAccountId, videoProvider, videoUrl,
      internal, status: explicitStatus, internalNote,
    } = parsed.data;

    if (calendarAccountId) {
      const { data: acc } = await supabaseAdmin
        .from("calendar_accounts")
        .select("id")
        .eq("id", calendarAccountId)
        .eq("user_id", req.userId!)
        .maybeSingle();
      if (!acc) {
        res.status(403).json({ error: "calendar_account_not_owned" });
        return;
      }
    }

    // Phase 4 : résolution automatique du fournisseur visio. Si Meet/Teams
    // ne peut pas être honoré (pas de calendrier compatible) on retombe sur
    // Jitsi. Si rien n'est demandé on prend la préférence utilisateur, défaut
    // Jitsi — ainsi tout RDV créé reçoit automatiquement un lien visio.
    const effVideoProvider = await resolveEffectiveVideoProvider(
      req.userId!,
      videoProvider,
      calendarAccountId,
    );

    const initialVideoUrl =
      effVideoProvider === "jitsi"
        ? videoUrl || generateJitsiUrl()
        : effVideoProvider === "none"
          ? null
          : videoUrl || null;

    // Statut par défaut intelligent : un RDV avec des participants externes
    // (= RDV client non marqué "interne") part en "pending" tant que personne
    // n'a confirmé. Sans participants, ou RDV interne d'équipe → "confirmed".
    // Évite d'afficher "Confirmé" alors qu'aucun invité n'a répondu.
    const hasParticipants = !!(participants && participants.trim());
    const defaultStatus = hasParticipants && !internal ? "pending" : "confirmed";
    const finalStatus = explicitStatus ?? defaultStatus;

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .insert({
        user_id: req.userId!,
        title,
        description: description || null,
        location: location || null,
        start_at: startAt,
        end_at: endAt,
        all_day: allDay || false,
        email_id: emailId || null,
        project_id: projectId || null,
        reminder_minutes: reminderMinutes ?? 30,
        participants: participants || null,
        calendar_account_id: calendarAccountId || null,
        video_provider: effVideoProvider === "none" ? null : effVideoProvider,
        video_url: initialVideoUrl,
        internal: internal || false,
        status: finalStatus,
      })
      .select("*, projects(id, name, reference, color)")
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }

    // Push best-effort vers le calendrier externe choisi (Phase 2).
    if (calendarAccountId) {
      try {
        const pushed = await pushAppointmentToProvider(
          req.userId!, calendarAccountId, buildPushPayload(data),
        );
        if (pushed) {
          const { data: updated } = await supabaseAdmin
            .from("appointments")
            .update({
              external_provider: pushed.provider,
              external_id: pushed.externalId,
              external_calendar_id: pushed.calendarId,
              last_synced_at: new Date().toISOString(),
              last_sync_error: null,
              ...(pushed.videoUrl ? { video_url: pushed.videoUrl } : {}),
              ...(pushed.videoJoinUrl ? { video_join_url: pushed.videoJoinUrl } : {}),
            })
            .eq("id", data.id)
            .select("*, projects(id, name, reference, color)")
            .single();
          if (updated) Object.assign(data, updated);
        } else {
          await supabaseAdmin
            .from("appointments")
            .update({ last_sync_error: "push_failed" })
            .eq("id", data.id);
          data.last_sync_error = "push_failed";
        }
      } catch (e: any) {
        req.log?.warn?.({ err: e?.message }, "[appointments] push to provider crashed");
      }
    }

    // Task #316 : si le RDV est en "pending" avec au moins un participant
    // externe (pas un email de l'organisation), on envoie automatiquement le
    // mail de proposition au 1er destinataire externe via le helper Inboria.
    // Le helper attache proposal_message_id pour que la réponse soit triée
    // ensuite par le worker (classifyMeetingReply).
    if (finalStatus === "pending" && participants && participants.trim()) {
      try {
        const emailList = participants
          .split(/[,;\n]/)
          .map((s) => s.trim())
          .filter(Boolean);
        const myOrgId = await getOrgIdForUser(req.userId!);
        let memberEmails = new Set<string>();
        if (myOrgId) {
          const { data: members } = await supabaseAdmin
            .from("organisation_members")
            .select("user_id, profiles!inner(email)")
            .eq("organisation_id", myOrgId);
          for (const m of (members || []) as any[]) {
            const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            const em = prof?.email ? String(prof.email).toLowerCase() : null;
            if (em) memberEmails.add(em);
          }
          // Fallback : si la jointure profiles ne renvoie pas l'email,
          // on tente email_connections (chaque membre a au moins un compte connecté).
          if (memberEmails.size === 0) {
            const { data: memberRows } = await supabaseAdmin
              .from("organisation_members")
              .select("user_id")
              .eq("organisation_id", myOrgId);
            const uids = (memberRows || []).map((r: any) => r.user_id).filter(Boolean);
            if (uids.length > 0) {
              const { data: conns } = await supabaseAdmin
                .from("email_connections")
                .select("email_address")
                .in("user_id", uids);
              for (const c of (conns || []) as Array<{ email_address: string }>) {
                if (c.email_address) memberEmails.add(c.email_address.toLowerCase());
              }
            }
          }
        }
        const externals = emailList.filter((em) => !memberEmails.has(em.toLowerCase()));
        if (externals.length > 0) {
          // Lang : on utilise la lang de l'email source si dispo, sinon "fr".
          let lang = "fr";
          if (emailId) {
            const { data: srcEmail } = await supabaseAdmin
              .from("emails")
              .select("language")
              .eq("id", emailId)
              .maybeSingle();
            lang = (srcEmail as { language?: string } | null)?.language || "fr";
          }
          // Un seul destinataire externe tracké par RDV (1er externe). Sinon
          // chaque appel consommerait des crédits IA + l'UPDATE écraserait
          // proposal_message_id/proposal_recipient/proposal_lang du précédent,
          // rendant le tri des réponses des autres externes impossible.
          // Pour plusieurs externes, utiliser /propose-multi.
          const ext = externals[0]!;
          const r = await sendProposalForExistingAppointment({
            userId: req.userId!,
            appointmentId: data.id,
            to: ext,
            lang,
          });
          if (!r.ok) {
            req.log?.warn?.(
              { err: r.error, to: ext, apptId: data.id },
              "[appointments] auto-propose failed",
            );
          }
          if (externals.length > 1) {
            req.log?.info?.(
              { apptId: data.id, ignored: externals.slice(1) },
              "[appointments] auto-propose: only 1st external recipient is tracked",
            );
          }
        }
      } catch (e: any) {
        req.log?.warn?.({ err: e?.message }, "[appointments] auto-propose crashed");
      }
    }

    // Task #316 : note interne optionnelle créée en même temps que le RDV.
    if (internalNote && internalNote.body) {
      try {
        const orgId = await getOrgIdForUser(req.userId!);
        if (orgId) {
          // Sécurité : intersection systématique avec les membres de l'orga
          // pour empêcher un user de notifier un UUID externe (cross-tenant).
          const { data: orgMembers } = await supabaseAdmin
            .from("organisation_members")
            .select("user_id")
            .eq("organisation_id", orgId);
          const orgMemberIds = new Set(
            ((orgMembers || []) as Array<{ user_id: string }>).map((m) => m.user_id),
          );
          const safeRecipientUserIds = (internalNote.recipientUserIds || []).filter((uid) =>
            orgMemberIds.has(uid),
          );
          const { data: inserted } = await supabaseAdmin
            .from("appointment_internal_notes")
            .insert({
              appointment_id: data.id,
              user_id: req.userId,
              organisation_id: orgId,
              body: internalNote.body,
              recipient_user_ids: safeRecipientUserIds.length > 0 ? safeRecipientUserIds : null,
            })
            .select("id")
            .maybeSingle();
          if (inserted) {
            try {
              const authorName = await getUserName(req.userId!);
              const preview = internalNote.body.length > 80
                ? internalNote.body.slice(0, 80) + "…"
                : internalNote.body;
              // Targets : si recipientUserIds explicite (déjà filtré orga),
              // on cible ceux-là. Sinon, tous les autres membres de l'orga.
              let targets: string[] = [];
              if (safeRecipientUserIds.length > 0) {
                targets = safeRecipientUserIds.filter((uid) => uid !== req.userId);
              } else {
                targets = Array.from(orgMemberIds).filter((uid) => uid && uid !== req.userId);
              }
              for (const uid of targets) {
                await createNotification({
                  userId: uid,
                  type: "appointment_internal_comment",
                  title: `${authorName} a commenté « ${data.title || "RDV"} »`,
                  message: preview,
                  triggeredBy: req.userId,
                });
              }
            } catch (e: any) {
              req.log?.warn?.({ err: e?.message }, "[appointments] internal note notify failed (create)");
            }
          }
        }
      } catch (e: any) {
        req.log?.warn?.({ err: e?.message }, "[appointments] internal note insert failed (create)");
      }
    }

    recordAutopilotEvent({
      userId: req.userId!,
      eventType: "appointment_extracted",
      title: data.title || null,
      emailId: data.email_id ?? null,
      metadata: { source: "create_appointment" },
    }).catch(() => {});
    emitWebhook({
      userId: req.userId!,
      event: "appointment.created",
      payload: {
        id: data.id,
        title: data.title,
        startAt: data.start_at,
        endAt: data.end_at,
        emailId: data.email_id,
        projectId: data.project_id,
      },
    }).catch(() => {});
    res.status(201).json(mapAppointment(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/appointments/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const parsed = updateAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;

    // Load existing row first to validate the *effective* interval and to
    // know whether we are switching the destination calendar.
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("appointments")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .single();
    if (existingErr || !existing) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    const effStart = body.startAt ?? existing.start_at;
    const effEnd = body.endAt ?? existing.end_at;
    if (Date.parse(effEnd) < Date.parse(effStart)) {
      res.status(400).json({ error: "endAt must be after startAt" });
      return;
    }

    // If destination calendar is being changed, validate ownership.
    const wantsCalendarChange =
      body.calendarAccountId !== undefined &&
      (body.calendarAccountId || null) !== (existing.calendar_account_id || null);
    if (wantsCalendarChange && body.calendarAccountId) {
      const { data: acc } = await supabaseAdmin
        .from("calendar_accounts")
        .select("id")
        .eq("id", body.calendarAccountId)
        .eq("user_id", req.userId!)
        .maybeSingle();
      if (!acc) {
        res.status(403).json({ error: "calendar_account_not_owned" });
        return;
      }
    }

    // Phase 4 : si le client demande Meet/Teams sans calendrier compatible,
    // on retombe sur Jitsi plutôt que d'échouer (un RDV doit toujours pouvoir
    // recevoir un lien visio).
    const effCalendarAccountId =
      body.calendarAccountId !== undefined ? body.calendarAccountId : existing.calendar_account_id;
    let effVideoProvider: VideoProvider | null;
    if (body.videoProvider !== undefined) {
      effVideoProvider = await resolveEffectiveVideoProvider(
        req.userId!,
        body.videoProvider as VideoProvider | null,
        effCalendarAccountId,
      );
    } else if (wantsCalendarChange) {
      // Le calendrier change mais le client n'a pas re-spécifié la visio :
      // on recompute pour éviter de garder un Meet/Teams incompatible avec
      // le nouveau calendrier (fallback Jitsi le cas échéant).
      const current = (existing.video_provider as VideoProvider | null) ?? null;
      if (current && current !== "none") {
        effVideoProvider = await resolveEffectiveVideoProvider(
          req.userId!,
          current,
          effCalendarAccountId,
        );
      } else {
        effVideoProvider = current;
      }
    } else {
      effVideoProvider = (existing.video_provider as VideoProvider | null) ?? null;
    }

    // Si le recompute a basculé sur un autre fournisseur sans demande explicite
    // du client, on persiste tout de même la nouvelle valeur effective.
    const providerChangedByFallback =
      body.videoProvider === undefined &&
      wantsCalendarChange &&
      effVideoProvider !== ((existing.video_provider as VideoProvider | null) ?? null);

    const updates: Record<string, any> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.location !== undefined) updates.location = body.location;
    if (body.startAt !== undefined) updates.start_at = body.startAt;
    if (body.endAt !== undefined) updates.end_at = body.endAt;
    if (body.allDay !== undefined) updates.all_day = body.allDay;
    if (body.emailId !== undefined) updates.email_id = body.emailId || null;
    if (body.projectId !== undefined) updates.project_id = body.projectId || null;
    if (body.reminderMinutes !== undefined) updates.reminder_minutes = body.reminderMinutes;
    if (body.status !== undefined) {
      updates.status = body.status;
    }
    if (body.confirmed !== undefined) {
      updates.confirmed = body.confirmed;
      // Si on confirme une contre-proposition, promouvoir en "confirmed"
      // et appliquer les créneaux contre-proposés comme nouveaux start/end.
      if (
        body.confirmed === true &&
        existing.status === "counter_proposed" &&
        existing.counter_start_at &&
        existing.counter_end_at
      ) {
        updates.status = "confirmed";
        if (body.startAt === undefined) updates.start_at = existing.counter_start_at;
        if (body.endAt === undefined) updates.end_at = existing.counter_end_at;
        updates.counter_start_at = null;
        updates.counter_end_at = null;
        updates.awaiting_reminder_at = null;
      }
    }
    if (body.participants !== undefined) updates.participants = body.participants || null;
    if (body.internal !== undefined) {
      updates.internal = body.internal;
      // Si on bascule un RDV existant en interne, on purge automatiquement les
      // participants externes pour éviter qu'ils restent attachés au RDV équipe.
      if (body.internal === true && body.participants === undefined) {
        updates.participants = null;
      }
    }
    if (body.videoProvider !== undefined || providerChangedByFallback) {
      // Persister la valeur EFFECTIVE (post-fallback), pas la valeur brute,
      // sinon on enregistrerait "meet" alors que l'on a basculé en Jitsi.
      updates.video_provider = effVideoProvider === "none" ? null : effVideoProvider;
      if (effVideoProvider === "none" || effVideoProvider === null) {
        updates.video_url = null;
        updates.video_join_url = null;
      } else if (effVideoProvider === "jitsi" && body.videoUrl === undefined) {
        if (!existing.video_url || existing.video_provider !== "jitsi") {
          updates.video_url = generateJitsiUrl();
          updates.video_join_url = null;
        }
      } else if (effVideoProvider === "meet" || effVideoProvider === "teams") {
        if (existing.video_provider !== effVideoProvider) {
          updates.video_url = null;
          updates.video_join_url = null;
        }
      }
    }
    if (body.videoUrl !== undefined) {
      updates.video_url = body.videoUrl || null;
    }
    if (wantsCalendarChange) {
      // Detach from previous external link; new push will happen below if a
      // new calendar account was provided.
      updates.calendar_account_id = body.calendarAccountId || null;
      updates.external_provider = null;
      updates.external_id = null;
      updates.external_calendar_id = null;
      updates.last_synced_at = null;
      updates.last_sync_error = null;
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .select("*, projects(id, name, reference, color)")
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }

    // If we detached from a previous external event, delete it remotely.
    if (
      wantsCalendarChange &&
      existing.calendar_account_id &&
      existing.external_provider &&
      existing.external_id
    ) {
      try {
        await deleteAppointmentOnProvider(
          req.userId!,
          existing.calendar_account_id,
          existing.external_provider,
          existing.external_id,
        );
      } catch (e: any) {
        req.log?.warn?.({ err: e?.message }, "[appointments] detach delete crashed");
      }
    }

    // If a new calendar destination was set, push as a fresh event.
    if (wantsCalendarChange && body.calendarAccountId) {
      try {
        const pushed = await pushAppointmentToProvider(
          req.userId!, body.calendarAccountId, buildPushPayload(data),
        );
        if (pushed) {
          const { data: updated } = await supabaseAdmin
            .from("appointments")
            .update({
              external_provider: pushed.provider,
              external_id: pushed.externalId,
              external_calendar_id: pushed.calendarId,
              last_synced_at: new Date().toISOString(),
              last_sync_error: null,
              ...(pushed.videoUrl ? { video_url: pushed.videoUrl } : {}),
              ...(pushed.videoJoinUrl ? { video_join_url: pushed.videoJoinUrl } : {}),
            })
            .eq("id", data.id)
            .select("*, projects(id, name, reference, color)")
            .single();
          if (updated) Object.assign(data, updated);
        } else {
          await supabaseAdmin
            .from("appointments")
            .update({ last_sync_error: "push_failed" })
            .eq("id", data.id);
          data.last_sync_error = "push_failed";
        }
      } catch (e: any) {
        req.log?.warn?.({ err: e?.message }, "[appointments] re-push crashed");
      }
    }

    // Otherwise, if content changed and we still have an existing link,
    // propagate the patch to the provider.
    const touchesContent =
      body.title !== undefined || body.description !== undefined ||
      body.location !== undefined || body.startAt !== undefined ||
      body.endAt !== undefined || body.allDay !== undefined ||
      body.participants !== undefined ||
      body.videoProvider !== undefined || body.videoUrl !== undefined;
    if (!wantsCalendarChange && touchesContent && data.calendar_account_id && data.external_provider && data.external_id) {
      try {
        const ok = await patchAppointmentOnProvider(
          req.userId!,
          data.calendar_account_id,
          data.external_provider,
          data.external_id,
          buildPushPayload(data),
        );
        await supabaseAdmin
          .from("appointments")
          .update({
            last_synced_at: new Date().toISOString(),
            last_sync_error: ok ? null : "patch_failed",
          })
          .eq("id", data.id);
      } catch (e: any) {
        req.log?.warn?.({ err: e?.message }, "[appointments] patch provider crashed");
      }
    }

    res.json(mapAppointment(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/appointments/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: existing } = await supabaseAdmin
      .from("appointments")
      .select("id, calendar_account_id, external_provider, external_id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("appointments")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId!);

    if (error) { res.status(500).json({ error: error.message }); return; }

    if (existing?.calendar_account_id && existing.external_provider && existing.external_id) {
      try {
        await deleteAppointmentOnProvider(
          req.userId!,
          existing.calendar_account_id,
          existing.external_provider,
          existing.external_id,
        );
      } catch (e: any) {
        req.log?.warn?.({ err: e?.message }, "[appointments] delete provider crashed");
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Phase 2 — pull inbound: importe les events externes en local appointments
// (idempotent via unique idx (user_id, external_provider, external_id)).
router.post("/appointments/sync", requireAuth, async (req, res): Promise<void> => {
  try {
    const start = (req.body?.start as string) || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const end = (req.body?.end as string) || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    if (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) {
      res.status(400).json({ error: "invalid_range" });
      return;
    }
    const result = await pullExternalEventsAndUpsert(req.userId!, start, end);
    res.json(result);
  } catch (err: any) {
    req.log?.error?.({ err: err?.message }, "[appointments] sync pull failed");
    res.status(500).json({ error: err.message });
  }
});

// RDV Phase 3 (#261) — proposition de rendez-vous 1 à 1 par Inboria.
// Crée un appointment `pending`, envoie un mail de proposition au contact,
// et programme la relance auto à +48h.
const proposeMeetingSchema = z
  .object({
    to: z.string().trim().email(),
    contactName: z.string().trim().min(1).max(200).optional(),
    subject: z.string().trim().min(1).max(200),
    startAt: isoDateTime,
    endAt: isoDateTime,
    location: z.string().max(500).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    lang: z.string().min(2).max(10).optional(),
    videoProvider: videoProviderSchema.optional().nullable(),
    fromConnectionId: z.string().uuid().optional().nullable(),
  })
  .refine((b) => Date.parse(b.endAt) > Date.parse(b.startAt), {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });

router.post("/appointments/propose", requireAuth, async (req, res): Promise<void> => {
  const parsed = proposeMeetingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const result = await proposeMeeting({ userId: req.userId!, ...parsed.data });
    if (!result.ok) {
      res.status(502).json({ error: result.error || "propose_failed" });
      return;
    }
    const { data } = await supabaseAdmin
      .from("appointments")
      .select("*, projects(id, name, reference, color)")
      .eq("id", result.appointmentId!)
      .eq("user_id", req.userId!)
      .single();
    res.status(201).json({
      ...mapAppointment(data),
      mirrored: result.mirrored ?? false,
      mirrorReason: result.mirrorReason ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "propose_crashed";
    req.log?.error?.({ err: msg }, "[appointments] propose crashed");
    res.status(500).json({ error: msg });
  }
});

// Multi-créneaux : un seul mail propose N créneaux à choisir. Toutes les
// lignes appointments créées partagent un proposal_group_id pour que le
// classifier puisse résoudre la réponse libre du contact.
const proposeMultiSlotSchema = z
  .object({ startAt: isoDateTime, endAt: isoDateTime })
  .refine((s) => Date.parse(s.endAt) > Date.parse(s.startAt), {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });
const proposeMultiSchema = z.object({
  to: z.string().trim().email(),
  contactName: z.string().trim().min(1).max(200).optional(),
  subject: z.string().trim().min(1).max(200),
  location: z.string().max(500).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  lang: z.string().min(2).max(10).optional(),
  slots: z.array(proposeMultiSlotSchema).min(2).max(8),
  fromConnectionId: z.string().uuid().optional().nullable(),
});
router.post("/appointments/propose-multi", requireAuth, async (req, res): Promise<void> => {
  const parsed = proposeMultiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const result = await proposeMeetingMulti({ userId: req.userId!, ...parsed.data });
    if (!result.ok) {
      res.status(502).json({ error: result.error || "propose_multi_failed" });
      return;
    }
    res.status(201).json({
      ok: true,
      appointmentIds: result.appointmentIds || [],
      mirrored: result.mirrored ?? false,
      mirrorReason: result.mirrorReason ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "propose_multi_crashed";
    req.log?.error?.({ err: msg }, "[appointments] propose-multi crashed");
    res.status(500).json({ error: msg });
  }
});

// Bloque en agenda un créneau PROPOSÉ PAR un contact via un mail reçu (statut
// pending, sans envoyer de mail). Le proposal_message_id pointe sur le
// Message-ID du mail source : la confirmation ultérieure du contact basculera
// automatiquement le RDV en `confirmed` via `handleIncomingEmailForMeeting`.
const holdSchema = z.object({
  emailId: z.union([z.string(), z.number()]),
  to: z.string().trim().email(),
  contactName: z.string().trim().min(1).max(200).optional(),
  subject: z.string().trim().min(1).max(200),
  location: z.string().max(500).optional().nullable(),
  startAt: isoDateTime,
  endAt: isoDateTime,
}).refine((v) => Date.parse(v.endAt) > Date.parse(v.startAt), {
  message: "endAt must be after startAt",
  path: ["endAt"],
});
router.post("/appointments/hold", requireAuth, async (req, res): Promise<void> => {
  const parsed = holdSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const result = await holdMeeting({ userId: req.userId!, ...parsed.data });
    if (!result.ok) {
      res.status(result.error === "email_not_found" ? 404 : 502).json({ error: result.error || "hold_failed" });
      return;
    }
    const { data } = await supabaseAdmin
      .from("appointments")
      .select("*, projects(id, name, reference, color)")
      .eq("id", result.appointmentId!)
      .eq("user_id", req.userId!)
      .single();
    res.status(201).json(mapAppointment(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "hold_crashed";
    req.log?.error?.({ err: msg }, "[appointments] hold crashed");
    res.status(500).json({ error: msg });
  }
});

const holdMultiSchema = z.object({
  emailId: z.union([z.string(), z.number()]),
  to: z.string().trim().email(),
  contactName: z.string().trim().min(1).max(200).optional(),
  subject: z.string().trim().min(1).max(200),
  location: z.string().max(500).optional().nullable(),
  slots: z.array(proposeMultiSlotSchema).min(2).max(8),
});
router.post("/appointments/hold-multi", requireAuth, async (req, res): Promise<void> => {
  const parsed = holdMultiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const result = await holdMeetingMulti({ userId: req.userId!, ...parsed.data });
    if (!result.ok) {
      res.status(result.error === "email_not_found" ? 404 : 502).json({ error: result.error || "hold_multi_failed" });
      return;
    }
    res.status(201).json({ ok: true, appointmentIds: result.appointmentIds || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "hold_multi_crashed";
    req.log?.error?.({ err: msg }, "[appointments] hold-multi crashed");
    res.status(500).json({ error: msg });
  }
});

// Bouton "Accepter ce créneau" pour une contre-proposition reçue : adopte
// counter_start_at/counter_end_at comme nouveaux start_at/end_at, repasse en
// confirmed=true, et envoie une confirmation courte au contact.
router.post(
  "/appointments/:id/accept-counter",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const { data: appt } = await supabaseAdmin
        .from("appointments")
        .select(
          "id, user_id, title, status, counter_start_at, counter_end_at, proposal_recipient, proposal_lang",
        )
        .eq("id", req.params.id)
        .eq("user_id", req.userId!)
        .maybeSingle();
      if (!appt) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (appt.status !== "counter_proposed" || !appt.counter_start_at || !appt.counter_end_at) {
        res.status(409).json({ error: "no_counter_proposal" });
        return;
      }
      const { data: updated, error } = await supabaseAdmin
        .from("appointments")
        .update({
          start_at: appt.counter_start_at,
          end_at: appt.counter_end_at,
          status: "confirmed",
          confirmed: true,
          counter_start_at: null,
          counter_end_at: null,
          awaiting_reminder_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.params.id)
        .eq("user_id", req.userId!)
        .select("*, projects(id, name, reference, color)")
        .single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      // Filet de sécurité : si la ligne n'a pas encore été miroirée vers
      // Google/Outlook (cas typique des RDV multi-créneaux où le push est
      // différé jusqu'à la confirmation, ou des anciens RDV créés avant le
      // fix calendar_account_id), on push maintenant — best-effort, jamais
      // bloquant. Le RDV reste source de vérité dans Inboria.
      if (updated && !updated.external_id && updated.calendar_account_id) {
        try {
          const pushed = await pushAppointmentToProvider(
            req.userId!,
            updated.calendar_account_id,
            buildPushPayload(updated),
          );
          if (pushed) {
            const { data: repushed } = await supabaseAdmin
              .from("appointments")
              .update({
                external_provider: pushed.provider,
                external_id: pushed.externalId,
                external_calendar_id: pushed.calendarId,
                last_synced_at: new Date().toISOString(),
                last_sync_error: null,
                ...(pushed.videoUrl ? { video_url: pushed.videoUrl } : {}),
                ...(pushed.videoJoinUrl ? { video_join_url: pushed.videoJoinUrl } : {}),
              })
              .eq("id", updated.id)
              .select("*, projects(id, name, reference, color)")
              .single();
            if (repushed) Object.assign(updated, repushed);
          } else {
            await supabaseAdmin
              .from("appointments")
              .update({ last_sync_error: "push_failed" })
              .eq("id", updated.id);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          req.log?.warn?.({ err: msg, apptId: updated.id }, "[appointments] accept-counter deferred push crashed");
        }
      }
      // Best-effort : envoyer la confirmation au contact pour clore la boucle
      // en 1 clic. Échec silencieux (le RDV reste confirmé en base).
      if (appt.proposal_recipient) {
        try {
          await sendCounterAcceptedEmail({
            userId: req.userId!,
            to: appt.proposal_recipient,
            subject: appt.title || "Rendez-vous",
            startAt: String(appt.counter_start_at),
            endAt: String(appt.counter_end_at),
            lang: appt.proposal_lang || "fr",
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          req.log?.warn?.({ err: msg, apptId: req.params.id }, "[appointments] accept-counter confirmation email failed (best-effort)");
        }
      }
      res.json(mapAppointment(updated));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "accept_counter_crashed";
      res.status(500).json({ error: msg });
    }
  },
);

// Refuse une contre-proposition reçue : envoie un mail de refus poli au
// contact, puis bascule le RDV en `cancelled` (la ligne disparaîtra de
// l'agenda grâce au filtre GET /appointments).
router.post(
  "/appointments/:id/decline-counter",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const { data: appt } = await supabaseAdmin
        .from("appointments")
        .select(
          "id, user_id, title, status, counter_start_at, counter_end_at, proposal_recipient, proposal_lang",
        )
        .eq("id", req.params.id)
        .eq("user_id", req.userId!)
        .maybeSingle();
      if (!appt) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (appt.status !== "counter_proposed" || !appt.counter_start_at || !appt.counter_end_at) {
        res.status(409).json({ error: "no_counter_proposal" });
        return;
      }
      // 1) On bascule d'abord la ligne en cancelled pour garantir la cohérence
      //    DB. Si l'update échoue, on n'envoie PAS de mail de refus (sinon
      //    contact reçoit un refus mais la ligne reste counter_proposed).
      const { error } = await supabaseAdmin
        .from("appointments")
        .update({
          status: "cancelled",
          confirmed: false,
          awaiting_reminder_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.params.id)
        .eq("user_id", req.userId!);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      // 2) Best-effort : envoyer le mail de refus poli au contact.
      if (appt.proposal_recipient) {
        try {
          await sendCounterDeclinedEmail({
            userId: req.userId!,
            to: appt.proposal_recipient,
            subject: appt.title || "Rendez-vous",
            startAt: String(appt.counter_start_at),
            endAt: String(appt.counter_end_at),
            lang: appt.proposal_lang || "fr",
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          req.log?.warn?.({ err: msg, apptId: req.params.id }, "[appointments] decline-counter email failed (best-effort)");
        }
      }
      res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "decline_counter_crashed";
      res.status(500).json({ error: msg });
    }
  },
);

// Annule la proposition (statut → cancelled), désactive la relance.
router.post(
  "/appointments/:id/cancel-proposal",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const { data: updated, error } = await supabaseAdmin
        .from("appointments")
        .update({
          status: "cancelled",
          confirmed: false,
          awaiting_reminder_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.params.id)
        .eq("user_id", req.userId!)
        .select("*, projects(id, name, reference, color)")
        .single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json(mapAppointment(updated));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "cancel_proposal_crashed";
      res.status(500).json({ error: msg });
    }
  },
);

// ---------------------------------------------------------------------------
// RDV Phase 5 (#263) — Multi-participants avec créneau commun
// ---------------------------------------------------------------------------

const participantInputSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1).max(200).optional().nullable(),
  isRequired: z.boolean().optional(),
});

const multiProposeSchema = z
  .object({
    subject: z.string().trim().min(1).max(200),
    description: z.string().max(2000).optional().nullable(),
    location: z.string().max(500).optional().nullable(),
    startAt: isoDateTime,
    endAt: isoDateTime,
    participants: z.array(participantInputSchema).min(3),
    lang: z.string().min(2).max(10).optional(),
    videoProvider: videoProviderSchema.optional().nullable(),
  })
  .refine((b) => Date.parse(b.endAt) > Date.parse(b.startAt), {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });

router.post("/appointments/multi-propose", requireAuth, async (req, res): Promise<void> => {
  const parsed = multiProposeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const result = await proposeMultiMeeting({ userId: req.userId!, ...parsed.data });
    if (!result.ok) {
      res.status(502).json({ error: result.error || "multi_propose_failed" });
      return;
    }
    const { data } = await supabaseAdmin
      .from("appointments")
      .select("*, projects(id, name, reference, color)")
      .eq("id", result.appointmentId!)
      .eq("user_id", req.userId!)
      .single();
    res.status(201).json({
      ...mapAppointment(data),
      participantsCreated: result.participantsCreated || 0,
      invitesSent: result.invitesSent || 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "multi_propose_crashed";
    req.log?.error?.({ err: msg }, "[appointments] multi-propose crashed");
    res.status(500).json({ error: msg });
  }
});

const findCommonSlotsSchema = z.object({
  emails: z.array(z.string().email()).min(1),
  durationMinutes: z.coerce.number().int().min(15).max(480),
  windowDays: z.coerce.number().int().min(1).max(60).optional(),
});

router.post("/appointments/find-common-slots", requireAuth, async (req, res): Promise<void> => {
  const parsed = findCommonSlotsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const result = await findMultiCommonSlots(
      req.userId!,
      parsed.data.emails,
      parsed.data.durationMinutes,
      parsed.data.windowDays ?? 14,
    );
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "find_common_slots_crashed";
    req.log?.error?.({ err: msg }, "[appointments] find-common-slots crashed");
    res.status(500).json({ error: msg });
  }
});

router.get("/appointments/:id/participants", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .maybeSingle();
    if (!appt) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { data: rows, error } = await supabaseAdmin
      .from("appointment_participants")
      .select("*")
      .eq("appointment_id", req.params.id)
      .order("created_at", { ascending: true });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    interface ParticipantDbRow {
      id: string;
      appointment_id: string;
      email: string;
      name: string | null;
      is_required: boolean;
      response_status: string;
      responded_at: string | null;
      last_reminder_sent_at: string | null;
      reminder_count: number;
      created_at: string;
    }
    res.json(
      ((rows ?? []) as ParticipantDbRow[]).map((r) => ({
        id: r.id,
        appointmentId: r.appointment_id,
        email: r.email,
        name: r.name,
        isRequired: r.is_required,
        responseStatus: r.response_status,
        respondedAt: r.responded_at,
        lastReminderSentAt: r.last_reminder_sent_at,
        reminderCount: r.reminder_count,
        createdAt: r.created_at,
      })),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "participants_crashed";
    res.status(500).json({ error: msg });
  }
});

const patchParticipantSchema = z.object({
  responseStatus: z.enum(["accepted", "declined", "tentative"]),
});

router.patch(
  "/appointments/:id/participants/:pid",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = patchParticipantSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }
    try {
      const { data: appt } = await supabaseAdmin
        .from("appointments")
        .select("id")
        .eq("id", req.params.id)
        .eq("user_id", req.userId!)
        .maybeSingle();
      if (!appt) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const result = await updateParticipantStatus(
        String(req.params.id),
        String(req.params.pid),
        parsed.data.responseStatus,
      );
      if (!result.ok) {
        res.status(500).json({ error: result.error || "update_failed" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "patch_participant_crashed";
      res.status(500).json({ error: msg });
    }
  },
);

router.post(
  "/appointments/:id/participants/:pid/remind",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const result = await remindParticipant(req.userId!, String(req.params.id), String(req.params.pid));
      if (!result.ok) {
        res.status(400).json({ error: result.error || "remind_failed" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "remind_crashed";
      req.log?.error?.({ err: msg }, "[appointments] remind crashed");
      res.status(500).json({ error: msg });
    }
  },
);

// Rejoue le matching transactionnel sur tous les RDV pending du user courant.
// Utile pour rattraper les confirmations arrivées AVANT le déploiement du fix
// (ex: cas Petit Zoo). Idempotent — peut être déclenché plusieurs fois sans
// risque.
router.post("/appointments/replay-transactional-confirms", requireAuth, async (req, res): Promise<void> => {
  try {
    const result = await replayTransactionalConfirmsForUser(req.userId!);
    res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "replay_crashed";
    req.log?.error?.({ err: msg }, "[appointments] replay transactional crashed");
    res.status(500).json({ error: msg });
  }
});

// ---------------------------------------------------------------------------
// Co-organisateurs internes (Business). Permet d'inviter d'autres membres de
// l'organisation à recevoir les notifs RDV (client a confirmé/refusé/contre-
// proposé, rappel imminent) sans être destinataires du mail côté client.
// Cf. .local/tasks/notif-matrix-plans.md + migration
// 2026_05_23_appointment_coorganizers.sql (à appliquer manuellement).
// ---------------------------------------------------------------------------

router.get(
  "/appointments/:id/coorganizers",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const id = String(req.params["id"]);
      const { data: appt } = await supabaseAdmin
        .from("appointments")
        .select("user_id")
        .eq("id", id)
        .maybeSingle();
      if (!appt) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const ownerId = (appt as { user_id: string }).user_id;
      const myOrg = await getOrgIdForUser(req.userId!);
      const ownerOrg = await getOrgIdForUser(ownerId);
      if (!myOrg || !ownerOrg || myOrg !== ownerOrg) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const { data: rows } = await supabaseAdmin
        .from("appointment_coorganizers")
        .select("id, user_id, added_at, added_by")
        .eq("appointment_id", id);
      const list = (rows || []) as Array<{
        id: number;
        user_id: string;
        added_at: string;
        added_by: string | null;
      }>;
      const userIds = list.map((r) => r.user_id);
      const profMap = new Map<string, string>();
      const emailMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        for (const p of (profiles || []) as Array<{ id: string; full_name: string | null }>) {
          profMap.set(p.id, p.full_name || "");
        }
        for (const uid of userIds) {
          try {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
            emailMap.set(uid, u.user?.email || "");
          } catch {
            /* noop */
          }
        }
      }
      res.json(
        list.map((r) => ({
          id: r.id,
          userId: r.user_id,
          fullName: profMap.get(r.user_id) || "",
          email: emailMap.get(r.user_id) || "",
          addedAt: r.added_at,
          addedBy: r.added_by,
        })),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "coorg_list_failed";
      req.log?.error?.({ err: msg }, "[appointments] coorg list failed");
      res.status(500).json({ error: msg });
    }
  },
);

router.post(
  "/appointments/:id/coorganizers",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const id = String(req.params["id"]);
      const inviteeId = String((req.body as { userId?: string } | undefined)?.userId || "");
      if (!inviteeId) {
        res.status(400).json({ error: "userId required" });
        return;
      }
      const { data: appt } = await supabaseAdmin
        .from("appointments")
        .select("user_id, title")
        .eq("id", id)
        .maybeSingle();
      if (!appt) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const apptRow = appt as { user_id: string; title: string | null };
      if (apptRow.user_id !== req.userId) {
        res.status(403).json({ error: "Only the owner can add co-organizers" });
        return;
      }
      if (inviteeId === apptRow.user_id) {
        res.status(400).json({ error: "Owner is already organizer" });
        return;
      }
      const myOrg = await getOrgIdForUser(req.userId!);
      const inviteeOrg = await getOrgIdForUser(inviteeId);
      if (!myOrg || !inviteeOrg || myOrg !== inviteeOrg) {
        res.status(403).json({ error: "Not in same organisation" });
        return;
      }
      const { error } = await supabaseAdmin
        .from("appointment_coorganizers")
        .insert({
          appointment_id: id,
          user_id: inviteeId,
          organisation_id: myOrg,
          added_by: req.userId,
        });
      if (error && !/duplicate|unique/i.test(error.message)) {
        res.status(500).json({ error: error.message });
        return;
      }
      try {
        const adderName = await getUserName(req.userId!);
        const title = apptRow.title || "RDV";
        await createNotification({
          userId: inviteeId,
          type: "appointment_co_invited",
          title: `${adderName} t'a invité comme co-organisateur`,
          message: title,
          triggeredBy: req.userId,
        });
      } catch (e) {
        req.log?.warn?.(
          { err: (e as Error).message, inviteeId, appointmentId: id },
          "[appointments] coorg notify failed",
        );
      }
      res.status(201).json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "coorg_add_failed";
      req.log?.error?.({ err: msg }, "[appointments] coorg add failed");
      res.status(500).json({ error: msg });
    }
  },
);

router.delete(
  "/appointments/:id/coorganizers/:userId",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const id = String(req.params["id"]);
      const targetUserId = String(req.params["userId"]);
      const { data: appt } = await supabaseAdmin
        .from("appointments")
        .select("user_id")
        .eq("id", id)
        .maybeSingle();
      if (!appt) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const ownerId = (appt as { user_id: string }).user_id;
      // Owner peut retirer n'importe qui ; un co-org peut se retirer lui-même.
      if (ownerId !== req.userId && targetUserId !== req.userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      await supabaseAdmin
        .from("appointment_coorganizers")
        .delete()
        .eq("appointment_id", id)
        .eq("user_id", targetUserId);
      res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "coorg_remove_failed";
      req.log?.error?.({ err: msg }, "[appointments] coorg remove failed");
      res.status(500).json({ error: msg });
    }
  },
);

// ---------------------------------------------------------------------------
// Notes internes RDV (Business). Commentaires visibles uniquement par le
// owner + les co-organisateurs internes. Jamais envoyées au client.
// Notif type appointment_internal_comment. Migration manuelle :
// 2026_05_23_appointment_internal_notes.sql.
// ---------------------------------------------------------------------------

async function getApptParticipantsForNotes(
  appointmentId: string,
): Promise<{ ownerId: string | null; orgId: string | null; participantIds: string[]; title: string }> {
  const { data: appt } = await supabaseAdmin
    .from("appointments")
    .select("user_id, title")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return { ownerId: null, orgId: null, participantIds: [], title: "RDV" };
  const ownerId = (appt as { user_id: string }).user_id;
  const orgId = await getOrgIdForUser(ownerId);
  const { data: coorgs } = await supabaseAdmin
    .from("appointment_coorganizers")
    .select("user_id")
    .eq("appointment_id", appointmentId);
  const participantIds = Array.from(
    new Set<string>([
      ownerId,
      ...((coorgs || []) as Array<{ user_id: string }>).map((r) => r.user_id),
    ].filter(Boolean)),
  );
  return {
    ownerId,
    orgId,
    participantIds,
    title: (appt as { title: string | null }).title || "RDV",
  };
}

router.get(
  "/appointments/:id/internal-notes",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const id = String(req.params["id"]);
      const ctx = await getApptParticipantsForNotes(id);
      if (!ctx.ownerId) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      // Accès = owner OU co-org OU autre membre de la même orga (lecture
      // ouverte au sein de l'organisation, écriture restreinte plus bas).
      const myOrg = await getOrgIdForUser(req.userId!);
      if (!myOrg || myOrg !== ctx.orgId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const { data: rows } = await supabaseAdmin
        .from("appointment_internal_notes")
        .select("id, user_id, body, created_at, updated_at, recipient_user_ids")
        .eq("appointment_id", id)
        .order("created_at", { ascending: false });
      const list = (rows || []) as Array<{
        id: number;
        user_id: string;
        body: string;
        created_at: string;
        updated_at: string | null;
        recipient_user_ids: string[] | null;
      }>;
      const userIds = Array.from(new Set(list.map((r) => r.user_id)));
      const nameMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        for (const p of (profiles || []) as Array<{ id: string; full_name: string | null }>) {
          nameMap.set(p.id, p.full_name || "");
        }
      }
      res.json(
        list.map((r) => ({
          id: r.id,
          userId: r.user_id,
          authorName: nameMap.get(r.user_id) || "",
          body: r.body,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          recipientUserIds: r.recipient_user_ids || [],
        })),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "notes_list_failed";
      req.log?.error?.({ err: msg }, "[appointments] internal notes list failed");
      res.status(500).json({ error: msg });
    }
  },
);

router.post(
  "/appointments/:id/internal-notes",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const id = String(req.params["id"]);
      const reqBody = (req.body as { body?: string; recipientUserIds?: string[] } | undefined) || {};
      const body = String(reqBody.body || "").trim();
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const recipientUserIds = Array.isArray(reqBody.recipientUserIds)
        ? reqBody.recipientUserIds.filter((u) => typeof u === "string" && uuidRe.test(u)).slice(0, 50)
        : [];
      if (!body) {
        res.status(400).json({ error: "body required" });
        return;
      }
      if (body.length > 4000) {
        res.status(400).json({ error: "body too long (max 4000)" });
        return;
      }
      const ctx = await getApptParticipantsForNotes(id);
      if (!ctx.ownerId || !ctx.orgId) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const myOrg = await getOrgIdForUser(req.userId!);
      if (!myOrg || myOrg !== ctx.orgId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      // Task #316 : tout membre de l'organisation peut commenter (la
      // restriction owner-only était trop frustrante en équipe). Le contrôle
      // d'orga a déjà été fait plus haut (myOrg === ctx.orgId).
      // Sécurité : intersection systématique des destinataires avec les
      // membres de l'orga pour empêcher un user de notifier un UUID externe.
      const { data: orgMembers } = await supabaseAdmin
        .from("organisation_members")
        .select("user_id")
        .eq("organisation_id", myOrg);
      const orgMemberIds = new Set(
        ((orgMembers || []) as Array<{ user_id: string }>).map((m) => m.user_id),
      );
      const safeRecipientUserIds = recipientUserIds.filter((uid) => orgMemberIds.has(uid));
      const { data: inserted, error } = await supabaseAdmin
        .from("appointment_internal_notes")
        .insert({
          appointment_id: id,
          user_id: req.userId,
          organisation_id: myOrg,
          body,
          recipient_user_ids: safeRecipientUserIds.length > 0 ? safeRecipientUserIds : null,
        })
        .select("id, created_at")
        .maybeSingle();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      // Notif appointment_internal_comment : ciblée si recipientUserIds
      // explicite, sinon tous les autres membres de l'orga.
      try {
        const authorName = await getUserName(req.userId!);
        const preview = body.length > 80 ? body.slice(0, 80) + "…" : body;
        let targets: string[] = [];
        if (safeRecipientUserIds.length > 0) {
          targets = safeRecipientUserIds.filter((uid) => uid !== req.userId);
        } else {
          targets = Array.from(orgMemberIds).filter((uid) => uid && uid !== req.userId);
        }
        for (const uid of targets) {
          await createNotification({
            userId: uid,
            type: "appointment_internal_comment",
            title: `${authorName} a commenté « ${ctx.title} »`,
            message: preview,
            triggeredBy: req.userId,
          });
        }
      } catch (e) {
        req.log?.warn?.(
          { err: (e as Error).message, appointmentId: id },
          "[appointments] internal note notify failed",
        );
      }
      res.status(201).json({
        id: (inserted as { id: number } | null)?.id,
        createdAt: (inserted as { created_at: string } | null)?.created_at,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "note_add_failed";
      req.log?.error?.({ err: msg }, "[appointments] internal note add failed");
      res.status(500).json({ error: msg });
    }
  },
);

router.delete(
  "/appointments/:id/internal-notes/:noteId",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const id = String(req.params["id"]);
      const noteId = Number(req.params["noteId"]);
      if (!Number.isFinite(noteId)) {
        res.status(400).json({ error: "invalid noteId" });
        return;
      }
      const { data: note } = await supabaseAdmin
        .from("appointment_internal_notes")
        .select("id, user_id, appointment_id")
        .eq("id", noteId)
        .eq("appointment_id", id)
        .maybeSingle();
      if (!note) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const noteRow = note as { user_id: string; appointment_id: string };
      const ctx = await getApptParticipantsForNotes(id);
      // L'auteur peut supprimer sa propre note ; le owner peut supprimer
      // n'importe quelle note du RDV (modération).
      if (noteRow.user_id !== req.userId && ctx.ownerId !== req.userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      await supabaseAdmin
        .from("appointment_internal_notes")
        .delete()
        .eq("id", noteId);
      res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "note_remove_failed";
      req.log?.error?.({ err: msg }, "[appointments] internal note remove failed");
      res.status(500).json({ error: msg });
    }
  },
);

export default router;
