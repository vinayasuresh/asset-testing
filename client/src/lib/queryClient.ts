import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (res.ok) return;

  let rawBody = "";
  let parsedBody: any = null;
  try {
    rawBody = await res.text();
    if (rawBody) {
      parsedBody = JSON.parse(rawBody);
    }
  } catch {
    // Ignore JSON parse errors; we'll fall back to text
  }

  const error: any = new Error(
    parsedBody?.message || rawBody || res.statusText || "Request failed"
  );
  error.status = res.status;
  error.data = parsedBody ?? (rawBody || null);
  throw error;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};

  // SECURITY: Primary auth is now via HttpOnly cookie (set automatically)
  // Keep localStorage fallback for backward compatibility during migration
  const legacyToken = localStorage.getItem("token");
  if (legacyToken) {
    headers["Authorization"] = `Bearer ${legacyToken}`;
  }

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Required for cookies to be sent
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};

    // SECURITY: Primary auth is now via HttpOnly cookie (set automatically)
    // Keep localStorage fallback for backward compatibility during migration
    const legacyToken = localStorage.getItem("token");
    if (legacyToken) {
      headers["Authorization"] = `Bearer ${legacyToken}`;
    }

    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include", // Required for cookies to be sent
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
