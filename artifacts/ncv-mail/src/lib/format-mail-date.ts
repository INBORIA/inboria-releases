import {
  isToday,
  isYesterday,
  differenceInCalendarDays,
  format,
  type Locale,
} from "date-fns";

/**
 * Format Outlook-style :
 *  - aujourd'hui  → "14:32"
 *  - hier         → "Hier"
 *  - < 7 jours    → jour court ("lun.", "ven.")
 *  - même année   → "17 mai"
 *  - sinon        → "17/05/25"
 */
export function formatMailDate(date: Date | string | number, locale: Locale): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  if (isToday(d)) return format(d, "HH:mm", { locale });
  if (isYesterday(d)) return locale.code?.startsWith("fr") ? "Hier" : format(d, "EEE", { locale });

  const diff = differenceInCalendarDays(new Date(), d);
  if (diff >= 0 && diff < 7) return format(d, "EEE", { locale });

  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) return format(d, "d MMM", { locale });
  return format(d, "dd/MM/yy", { locale });
}

export type DateFilterValue =
  | "all"
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth";

export function matchesDateFilter(
  date: Date | string | number | null | undefined,
  filter: DateFilterValue,
): boolean {
  if (filter === "all") return true;
  if (!date) return false;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const diff = differenceInCalendarDays(new Date(), d);
  switch (filter) {
    case "today":
      return isToday(d);
    case "yesterday":
      return isYesterday(d);
    case "last7":
      return diff >= 0 && diff < 7;
    case "last30":
      return diff >= 0 && diff < 30;
    case "thisMonth": {
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    default:
      return true;
  }
}

export type ReadFilterValue = "all" | "unread" | "read";

export function matchesReadFilter(isRead: boolean, filter: ReadFilterValue): boolean {
  if (filter === "all") return true;
  if (filter === "unread") return !isRead;
  return isRead;
}
