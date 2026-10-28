import { getIdToken } from "./auth";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** fetch gegen die eigenen API-Routen mit Microsoft-ID-Token. Bei 401
 * (Token abgelaufen) einmal mit frischem Token wiederholen. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const run = async (forceRefresh: boolean) => {
    const token = await getIdToken(forceRefresh);
    return fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  };
  let response = await run(false);
  if (response.status === 401) response = await run(true);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error ?? "Anfrage fehlgeschlagen");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
