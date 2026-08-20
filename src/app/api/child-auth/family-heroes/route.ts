import { NextRequest, NextResponse } from "next/server";
import { resolveFamilyForPinLogin, heroesForFamily } from "@/lib/auth/child-login";

export async function POST(request: NextRequest) {
  const { familyCode } = await request.json().catch(() => ({}));
  const code = typeof familyCode === "string" ? familyCode : undefined;
  const familyId = await resolveFamilyForPinLogin(code);
  if (!familyId) {
    // Don't distinguish "bad code" from "no heroes" — just an empty list.
    return NextResponse.json({ heroes: [] });
  }
  // No code means this resolved via a signed-in parent's session (hand-off) —
  // show every child in the family, not just PIN-enabled ones.
  const heroes = await heroesForFamily(familyId, { requirePin: !!code });
  return NextResponse.json({ heroes });
}
