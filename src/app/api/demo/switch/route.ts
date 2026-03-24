import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { DemoPersona } from "@/lib/auth/session";

const VALID_PERSONAS: DemoPersona[] = ["parent", "lily", "lucas"];

export async function POST(request: NextRequest) {
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Not in demo mode" }, { status: 403 });
  }

  const { persona } = await request.json();
  if (!VALID_PERSONAS.includes(persona)) {
    return NextResponse.json({ error: "Invalid persona" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set("demo_persona", persona, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true, persona });
}
