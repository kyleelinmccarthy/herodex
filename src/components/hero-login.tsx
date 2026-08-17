"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";
import type { AvatarConfig } from "@/lib/utils/avatar-catalog";

type Hero = { childId: string; displayName: string; avatarConfig: string | null };

// Family codes are always 8 characters (see generateLoginCode in child-login.ts).
const FAMILY_CODE_LENGTH = 8;

/**
 * Hero PIN sign-in.
 * - mode "standalone": the family code field, hero picker, and PIN field are
 *   all visible together on one screen from the start. Heroes auto-load
 *   (debounced) as soon as a full code is typed — no button to click — and
 *   the PIN field sits on screen the whole time, just disabled until a hero
 *   is picked (auto-picked when there's only one).
 * - mode "handoff": a parent is already signed in; heroes load immediately.
 */
export function HeroLogin({
  mode,
  prefillCode = "",
  onDone,
  onSwitchToEmail,
}: {
  mode: "standalone" | "handoff";
  prefillCode?: string;
  onDone?: () => void;
  onSwitchToEmail?: () => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState(prefillCode);
  const [heroes, setHeroes] = useState<Hero[] | null>(null);
  const [loadingHeroes, setLoadingHeroes] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [selected, setSelected] = useState<Hero | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadHeroes = useCallback(async (familyCode?: string) => {
    setLoadingHeroes(true);
    setCodeError("");
    setHeroes(null);
    setSelected(null);
    try {
      const res = await fetch("/api/child-auth/family-heroes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(familyCode ? { familyCode } : {}),
      });
      const data = await res.json();
      const list: Hero[] = data.heroes ?? [];
      setHeroes(list);
      if (list.length === 1) setSelected(list[0]);
      if (list.length === 0 && familyCode) {
        setCodeError(
          "No heroes found for that code. Double-check it with a grown-up, or ask them to set a PIN in Settings."
        );
      }
    } finally {
      setLoadingHeroes(false);
    }
  }, []);

  // Handoff mode (parent signed in) loads immediately.
  useEffect(() => {
    if (mode === "handoff") loadHeroes();
  }, [mode, loadHeroes]);

  // Standalone: auto-load heroes as soon as a full-length code is typed, so
  // there's no separate "submit the code" step before the hero/PIN fields
  // appear — the kid just keeps typing/tapping down the same form.
  useEffect(() => {
    if (mode !== "standalone") return;
    if (code.trim().length !== FAMILY_CODE_LENGTH) {
      setHeroes(null);
      setSelected(null);
      return;
    }
    const t = setTimeout(() => loadHeroes(code.trim()), 300);
    return () => clearTimeout(t);
  }, [mode, code, loadHeroes]);

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setPinError("");
    try {
      const res = await fetch("/api/child-auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send the family code (standalone) so the server can confirm this hero
        // belongs to it; hand-off mode omits it and resolves via the adult session.
        body: JSON.stringify({ childId: selected.childId, pin, familyCode: code || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPinError(data.error ?? "That PIN didn't work.");
        setSubmitting(false);
        return;
      }
      onDone?.();
      router.push("/tavern");
      router.refresh();
    } catch {
      setPinError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  const hasHeroes = !!heroes && heroes.length > 0;

  return (
    <div className="space-y-5">
      {mode === "standalone" && (
        <div className="space-y-2">
          <Label htmlFor="familyCode">Family Code</Label>
          <Input
            id="familyCode"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABCD2345"
            autoCapitalize="characters"
            autoComplete="off"
            autoFocus
            maxLength={FAMILY_CODE_LENGTH}
            className="font-mono tracking-widest"
            required
          />
          <p className="text-xs text-muted-foreground">
            This is the short code from a grown-up&apos;s account (under{" "}
            <span className="font-medium text-foreground">Settings → Family Login Code</span>).
            Don&apos;t have it? Ask them for it
            {onSwitchToEmail && (
              <>
                , or{" "}
                <button
                  type="button"
                  onClick={onSwitchToEmail}
                  className="font-medium text-primary underline underline-offset-2 hover:no-underline"
                >
                  sign in with email
                </button>{" "}
                instead
              </>
            )}
            .
          </p>
          {loadingHeroes && (
            <p className="text-xs text-muted-foreground">Looking for your heroes…</p>
          )}
          {codeError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {codeError}
            </div>
          )}
        </div>
      )}

      {heroes && heroes.length === 0 && !codeError && (
        <p className="text-sm text-muted-foreground">
          No heroes have a PIN yet — a grown-up can add one in Settings.
        </p>
      )}

      <div className="space-y-2">
        <Label>Pick your hero</Label>
        {hasHeroes ? (
          <div className="grid grid-cols-3 gap-3">
            {heroes!.map((h) => (
              <button
                key={h.childId}
                type="button"
                onClick={() => {
                  setSelected(h);
                  setPin("");
                  setPinError("");
                }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors hover:border-primary hover:bg-primary/10",
                  selected?.childId === h.childId
                    ? "border-primary bg-primary/10"
                    : "border-border"
                )}
              >
                <Avatar
                  config={h.avatarConfig ? (JSON.parse(h.avatarConfig) as AvatarConfig) : null}
                  name={h.displayName}
                  size="sm"
                />
                <span className="truncate text-xs font-medium">{h.displayName}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            {mode === "standalone"
              ? "Your heroes will show up here once you type your family code above."
              : "Loading heroes…"}
          </div>
        )}
      </div>

      <form onSubmit={handlePinSubmit} className="space-y-2">
        <Label htmlFor="pin">{selected ? `${selected.displayName}'s PIN` : "PIN"}</Label>
        <Input
          id="pin"
          type="password"
          inputMode="numeric"
          pattern="\d{4,6}"
          minLength={4}
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder={selected ? "••••" : "Pick your hero first"}
          disabled={!selected}
          className={cn(
            "text-center disabled:opacity-50",
            selected ? "text-2xl tracking-[0.5em]" : "text-sm tracking-normal"
          )}
          required
        />
        {pinError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {pinError}
          </div>
        )}
        <Button type="submit" className="w-full" disabled={!selected || submitting || pin.length < 4}>
          {submitting ? "Entering..." : "Enter the Realm"}
        </Button>
      </form>
    </div>
  );
}
