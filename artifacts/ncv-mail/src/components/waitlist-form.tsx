import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Loader2 } from "lucide-react";
import { useJoinWaitlist } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface WaitlistFormProps {
  defaultPlan?: "solo" | "pro" | "business" | null;
  defaultSeats?: number | null;
  source?: string;
  compact?: boolean;
}

export function WaitlistForm({ defaultPlan, defaultSeats, source, compact }: WaitlistFormProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const join = useJoinWaitlist();

  const isValid = (value: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!isValid(trimmed)) {
      setError(t("waitlist.invalidEmail"));
      return;
    }
    join.mutate(
      {
        data: {
          email: trimmed,
          plan: defaultPlan ?? null,
          seats: defaultSeats ?? null,
          locale: i18n.language || null,
          source: source ?? null,
        },
      },
      {
        onSuccess: (data) => {
          const already = data.alreadyRegistered === true;
          toast({
            title: already ? t("waitlist.alreadyRegisteredTitle") : t("waitlist.successTitle"),
            description: already
              ? t("waitlist.alreadyRegisteredDesc")
              : t("waitlist.successDesc"),
          });
          setEmail("");
        },
        onError: () => {
          toast({
            title: t("waitlist.errorTitle"),
            description: t("waitlist.errorDesc"),
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex flex-col sm:flex-row gap-2 ${compact ? "" : "max-w-xl mx-auto"}`}
      data-testid="waitlist-form"
    >
      <div className="flex-1">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("waitlist.emailPlaceholder")}
          required
          aria-label={t("waitlist.emailPlaceholder")}
          className="w-full px-3 py-2.5 text-[13px] bg-[#0d1117] border border-[#1f2937] rounded-lg text-white placeholder:text-[#6b7d96] focus:outline-none focus:border-[#2d7dd2]"
          data-testid="input-waitlist-email"
        />
        {error && (
          <p className="text-[11px] text-red-400 mt-1" data-testid="text-waitlist-error">
            {error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={join.isPending}
        className="px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-[#2d7dd2] text-white hover:bg-[#2563b1] disabled:opacity-50 flex items-center justify-center gap-2"
        data-testid="button-waitlist-submit"
      >
        {join.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Bell className="w-4 h-4" />
        )}
        {join.isPending ? t("waitlist.joining") : t("waitlist.joinButton")}
      </button>
    </form>
  );
}
