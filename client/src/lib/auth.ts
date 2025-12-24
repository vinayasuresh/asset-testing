import { apiRequest } from "./queryClient";

/**
 * SECURITY NOTE: JWT tokens are now stored in HttpOnly cookies (set by server).
 * localStorage is kept for backward compatibility during migration.
 * HttpOnly cookies are more secure as they cannot be accessed by JavaScript,
 * protecting against XSS token theft.
 */

/** @deprecated Use HttpOnly cookies. Kept for backward compatibility. */
export function getAuthToken(): string | null {
  return localStorage.getItem("token");
}

/** @deprecated Use HttpOnly cookies. Kept for backward compatibility. */
export function setAuthToken(token: string): void {
  localStorage.setItem("token", token);
}

/** Clear localStorage token (HttpOnly cookie is cleared by server on logout) */
export function removeAuthToken(): void {
  localStorage.removeItem("token");
}

export async function authenticatedRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  // Handle FormData differently from regular JSON data
  const isFormData = data instanceof FormData;

  const headers: Record<string, string> = {};

  // SECURITY: Primary auth is now via HttpOnly cookie (sent automatically)
  // Keep localStorage fallback for backward compatibility
  const legacyToken = getAuthToken();
  if (legacyToken) {
    headers["Authorization"] = `Bearer ${legacyToken}`;
  }

  // Only set Content-Type for JSON data, let browser set it for FormData
  if (data && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
    credentials: "include", // Required for HttpOnly cookies to be sent
  });

  if (!response.ok) {
    const responseText = await response.text();

    if (response.status === 401) {
      removeAuthToken();
      window.location.href = "/login";
      throw new Error("Authentication expired - please log in again");
    }
    throw new Error(`API Error ${response.status}: ${responseText}`);
  }

  return response;
}
