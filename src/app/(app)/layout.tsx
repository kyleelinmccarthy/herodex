import { redirect } from "next/navigation";
import { getSession, getDemoPersona, isChildPersona } from "@/lib/auth/session";
import { GameBanner, GameNavBar } from "@/components/game-nav";
import { DemoPersonaSwitcher } from "@/components/demo-persona-switcher";
import { QuestTimerPopup } from "@/components/quest-timer-popup";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const isDemoMode = process.env.DEMO_MODE === "true";
  const persona = isDemoMode ? await getDemoPersona() : null;
  const isChildView = persona ? isChildPersona(persona) : false;

  return (
    <div className="game-shell relative flex min-h-svh flex-col overflow-hidden">
      {/* Background orbs */}
      <div className="game-shell-orb game-shell-orb--1" />
      <div className="game-shell-orb game-shell-orb--2" />

      {/* Top banner with site name */}
      <GameBanner />

      {/* Main content */}
      <main className="game-content">
        {children}
      </main>

      {/* Bottom nav bar */}
      <GameNavBar userName={session.user.name} isChildView={isChildView} />

      {isDemoMode && persona && <DemoPersonaSwitcher current={persona} />}

      {/* Floating quest timer popup — visible on all pages when a timer is running */}
      <QuestTimerPopup />
    </div>
  );
}
