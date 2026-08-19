import { NextResponse } from "next/server";

export async function GET() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "APP_URL",
  ] as const;

  const missing = required.filter((key) => !process.env[key]);

  return NextResponse.json(
    {
      service: "ubuntu-africa-cloud",
      status: missing.length === 0 ? "ready" : "configuration_required",
      missing,
      timestamp: new Date().toISOString(),
    },
    { status: missing.length === 0 ? 200 : 503 }
  );
}
