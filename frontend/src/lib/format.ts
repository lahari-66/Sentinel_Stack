export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(isoString: string | null | undefined): string {
  if (!isoString) return "never";
  const seconds = Math.round((Date.now() - Date.parse(isoString)) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return rtf.format(-Math.round(seconds / size), unit);
  return "just now";
}

export function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const s = Math.round((Date.parse(end) - Date.parse(start)) / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

/** Last path segment of an ARN, e.g. sg-0abc… or a bucket name — for compact table cells. */
export function shortResource(arn: string): string {
  const tail = arn.split(":").pop() ?? arn;
  return tail.split("/").pop() || tail;
}
