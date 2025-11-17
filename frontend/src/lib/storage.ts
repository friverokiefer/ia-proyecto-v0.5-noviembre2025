// frontend/src/lib/storage.ts

/**
 * Genera la clave estandarizada para guardar formularios en localStorage.
 * Ej: type = "email_v2" → key = "form:email_v2"
 */
const KEY = (type: string) => `form:${type}`;

export function saveFormState<T extends Record<string, any>>(
  type: string,
  values: T
) {
  try {
    localStorage.setItem(KEY(type), JSON.stringify(values));
  } catch {
    // ignore
  }
}

export function loadFormState<T = Record<string, any>>(type: string): T | null {
  try {
    const raw = localStorage.getItem(KEY(type));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearFormState(type: string) {
  try {
    localStorage.removeItem(KEY(type));
  } catch {
    // ignore
  }
}
