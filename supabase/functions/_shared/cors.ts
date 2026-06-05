const ALLOWED_ORIGINS = [
  "https://montofinance.app",
  "https://www.montofinance.app",
  "http://localhost:8080",
  "http://localhost:5173",
];

const CORS_HEADERS_BASE = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
    ...CORS_HEADERS_BASE,
  };
}
