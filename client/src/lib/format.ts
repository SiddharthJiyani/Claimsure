export function displayName(input: {
  fullName?: string | null;
  email?: string | null;
}) {
  const name = input.fullName?.trim();
  if (name) return name;
  const email = input.email?.trim();
  if (!email) return "Signed in";
  return email.split("@")[0] ?? email;
}

export function initials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2);
  return (parts.join("") || name.slice(0, 1) || "C").toUpperCase();
}

export function relativeTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / 60_000);
  if (Math.abs(minutes) < 1) return "Just now";
  if (Math.abs(minutes) < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 14) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function summarizeService(raw: string | null | undefined) {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { title: "Service pending", meta: "" };

  const icd = text.match(/ICD-10[:\s]*([A-Z0-9.]+)/i);
  const cpt = text.match(/CPT[-\s]?(\d{4,5})/i);
  let title = text
    .split(/\s+Rx\b|\s+Medication\b|\s+Est\.\s*Cost\b|\s+Coverage policy\b|\s+We reviewed\b/i)[0]
    ?.replace(/\(ICD-10:[^)]+\)/gi, "")
    .replace(/[·|]+$/g, "")
    .trim();

  if (!title) title = text;
  if (title.length > 64) title = `${title.slice(0, 61).trimEnd()}…`;

  const meta = [
    icd ? `ICD-10 ${icd[1]}` : null,
    cpt ? `CPT-${cpt[1]}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { title, meta };
}

export function dayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
