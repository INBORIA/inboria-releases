import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, ChevronDown, Check } from "lucide-react";
import { useTranslation } from "react-i18next";

export type TaskAssigneeMember = {
  userId: string;
  fullName?: string | null;
  email?: string | null;
};

export function TaskAssigneePicker({
  members,
  currentUserId,
  value,
  onChange,
  className,
  triggerClassName,
}: {
  members: TaskAssigneeMember[];
  currentUserId: string | null | undefined;
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
  triggerClassName?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const me: TaskAssigneeMember | null = useMemo(() => {
    if (!currentUserId) return null;
    const found = members.find((m) => m.userId === currentUserId);
    return (
      found || {
        userId: currentUserId,
        fullName: t("tasks.assignMyself", "Moi"),
        email: null,
      }
    );
  }, [members, currentUserId, t]);

  const others = useMemo(
    () => members.filter((m) => m.userId !== currentUserId),
    [members, currentUserId]
  );

  const toggle = (uid: string) => {
    if (value.includes(uid)) onChange(value.filter((v) => v !== uid));
    else onChange([...value, uid]);
  };

  const label = useMemo(() => {
    if (value.length === 0) return t("tasks.assigneeNobody", "Pas d'assigné");
    if (value.length === 1) {
      const m = members.find((mm) => mm.userId === value[0]);
      if (value[0] === currentUserId) return t("tasks.assignMyself", "Moi");
      return m?.fullName || m?.email || value[0].slice(0, 6);
    }
    return t("tasks.assigneeCount", { count: value.length, defaultValue: `${value.length} personnes` });
  }, [value, members, currentUserId, t]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            triggerClassName ||
            "w-full h-8 px-2.5 inline-flex items-center justify-between gap-2 bg-background border border-border rounded-md text-[12px] text-white"
          }
        >
          <span className="inline-flex items-center gap-1.5 truncate">
            <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown className="w-3 h-3 text-[#8b9cb3] shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={className || "w-64 p-1.5 bg-card border-border"} align="start">
        <div className="text-[10px] uppercase tracking-wider text-[#8b9cb3] px-2 py-1">
          {t("tasks.assignTo", "Assigner à")}
        </div>
        {me && (
          <button
            type="button"
            onClick={() => toggle(me.userId)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#1a2235] text-left"
          >
            <Checkbox checked={value.includes(me.userId)} />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-white truncate">
                {t("tasks.assignMyself", "Moi")}
              </div>
              {me.email && (
                <div className="text-[10px] text-[#8b9cb3] truncate">{me.email}</div>
              )}
            </div>
            {value.includes(me.userId) && <Check className="w-3 h-3 text-cyan-400" />}
          </button>
        )}
        {others.length > 0 && (
          <div className="border-t border-border my-1" />
        )}
        {others.map((m) => (
          <button
            key={m.userId}
            type="button"
            onClick={() => toggle(m.userId)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#1a2235] text-left"
          >
            <Checkbox checked={value.includes(m.userId)} />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-white truncate">
                {m.fullName || m.email || m.userId.slice(0, 6)}
              </div>
              {m.email && m.fullName && (
                <div className="text-[10px] text-[#8b9cb3] truncate">{m.email}</div>
              )}
            </div>
            {value.includes(m.userId) && <Check className="w-3 h-3 text-cyan-400" />}
          </button>
        ))}
        {others.length === 0 && (
          <div className="px-2 py-2 text-[11px] text-[#8b9cb3]">
            {t("tasks.noTeamMembers", "Aucun autre membre dans l'équipe.")}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
