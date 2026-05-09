import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { recordAutopilotEvent } from "../services/autopilot-events";
import { emitWebhook } from "../services/webhooks";
import {
  pushAppointmentToProvider,
  patchAppointmentOnProvider,
  deleteAppointmentOnProvider,
  type AppointmentPushPayload,
} from "../services/calendar-sync";

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
  };
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
    const {
      title, description, location, startAt, endAt, allDay, emailId, projectId,
      reminderMinutes, participants, calendarAccountId,
    } = req.body;
    if (!title || !startAt || !endAt) {
      res.status(400).json({ error: "title, startAt and endAt are required" });
      return;
    }

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
          (data as any).last_sync_error = "push_failed";
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
    const updates: Record<string, any> = {};
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.location !== undefined) updates.location = req.body.location;
    if (req.body.startAt !== undefined) updates.start_at = req.body.startAt;
    if (req.body.endAt !== undefined) updates.end_at = req.body.endAt;
    if (req.body.allDay !== undefined) updates.all_day = req.body.allDay;
    if (req.body.emailId !== undefined) updates.email_id = req.body.emailId || null;
    if (req.body.projectId !== undefined) updates.project_id = req.body.projectId || null;
    if (req.body.reminderMinutes !== undefined) updates.reminder_minutes = req.body.reminderMinutes;
    if (req.body.confirmed !== undefined) updates.confirmed = req.body.confirmed;
    if (req.body.participants !== undefined) updates.participants = req.body.participants || null;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .select("*, projects(id, name, reference, color)")
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }

    // Propage la modification vers le calendrier externe (Phase 2, best-effort).
    const touchesContent =
      req.body.title !== undefined || req.body.description !== undefined ||
      req.body.location !== undefined || req.body.startAt !== undefined ||
      req.body.endAt !== undefined || req.body.allDay !== undefined ||
      req.body.participants !== undefined;
    if (touchesContent && data.calendar_account_id && data.external_provider && data.external_id) {
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

export default router;
