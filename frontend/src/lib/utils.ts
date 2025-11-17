export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}

export function validateUrl(str: string): boolean {
  try {
    const u = new URL(str);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}