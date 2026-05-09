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
import { proposeMeeting, sendCounterAcceptedEmail } from "../services/meeting-proposals";

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
  participants: participantsSchema.optional().nullable(),
  calendarAccountId: z.string().uuid().optional().nullable(),
  videoProvider: videoProviderSchema.optional().nullable(),
  videoUrl: z.string().url().max(2000).optional().nullable(),
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
    chosen = (pref as VideoProvider) || "jitsi";
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
    } else {
      effVideoProvider = (existing.video_provider as VideoProvider | null) ?? null;
    }

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
    if (body.confirmed !== undefined) updates.confirmed = body.confirmed;
    if (body.participants !== undefined) updates.participants = body.participants || null;
    if (body.videoProvider !== undefined) {
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
    res.status(201).json(mapAppointment(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "propose_crashed";
    req.log?.error?.({ err: msg }, "[appointments] propose crashed");
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

export default router;
