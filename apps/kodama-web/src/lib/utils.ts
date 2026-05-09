type ClassValue = string | number | boolean | undefined | null | ClassValue[] | Record<string, unknown>;

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (value: ClassValue) => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") {
      out.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === "object") {
      for (const [key, condition] of Object.entries(value)) {
        if (condition) out.push(key);
      }
    }
  };
  inputs.forEach(walk);
  return out.join(" ");
}
