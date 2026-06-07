import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { useScheduleEmail, getListScheduledEmailsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { UploadedFile } from "@/components/FileAttachInput";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  to: string;
  subject: string;
  body: string;
  replyToEmailId?: number | null;
  markHandledOfEmailId?: number | null;
  connectionId?: string | null;
  projectId?: string | null;
  attachments?: UploadedFile[];
  onScheduled?: () => void;
}

export function ScheduleSendDialog({ open, onOpenChange, to, subject, body, replyToEmailId, markHandledOfEmailId, connectionId, projectId, attachments, onScheduled }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("09:00");
  const scheduleMut = useScheduleEmail();

  const apply = () => {
    if (!date) return;
    const [h, m] = time.split(":").map(Number);
    const target = new Date(date);
    target.setHours(h || 9, m || 0, 0, 0);
    if (target.getTime() <= Date.now()) {
      toast({ variant: "destructive", title: t("wave1.scheduleErrorPast") });
      return;
    }
    const uploadIds = attachments?.map((a) => a.uploadId).filter(Boolean);
    const payload: any = {
      to,
      subject,
      body,
      replyToEmailId: replyToEmailId ?? null,
      markHandledOfEmailId: markHandledOfEmailId ?? null,
      connectionId: connectionId ?? null,
      projectId: projectId ?? null,
      scheduledSendAt: target.toISOString(),
    };
    if (uploadIds && uploadIds.length > 0) payload.attachments = uploadIds;
    scheduleMut.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast({ title: t("wave1.scheduleSuccess") });
          qc.invalidateQueries({ queryKey: getListScheduledEmailsQueryKey() });
          onOpenChange(false);
          setDate(undefined);
          onScheduled?.();
        },
        onError: (e: any) => {
          toast({ variant: "destructive", title: e?.message || "Schedule failed" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <CalendarClock className="w-4 h-4 text-primary" />
            {t("wave1.scheduleTitle")}
          </DialogTitle>
          <DialogDescription className="text-[12px]">{t("wave1.scheduleDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
            className="p-1 self-center"
          />
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-9 text-[13px]"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={scheduleMut.isPending}>
            {t("wave1.scheduleCancel")}
          </Button>
          <Button onClick={apply} disabled={!date || scheduleMut.isPending || !to.trim() || !subject.trim() || !body.trim()}>
            {scheduleMut.isPending ? "…" : t("wave1.scheduleApply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export default ScheduleSendDialog;
