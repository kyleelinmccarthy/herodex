import Link from "next/link";
import {
  getAssignmentsForDate,
  getAssignmentsForDateRange,
  generateAssignmentsFromSchedules,
} from "@/lib/actions/quest-assignments";
import { formatDate } from "@/lib/utils/dates";
import { GameFrame } from "@/components/game-frame";
import { GameIcon, type GameIconName } from "@/components/game-icon";
import { Avatar } from "@/components/avatar";
import type { AvatarConfig } from "@/lib/utils/avatar-catalog";
import type { getChildren } from "@/lib/actions/children";
import { ViewAsHeroButton } from "./view-as-hero-button";

type ChildRow = Awaited<ReturnType<typeof getChildren>>[number];

export async function ParentDashboard({ allChildren }: { allChildren: ChildRow[] }) {
  const today = formatDate(new Date());
  const weekOutDate = new Date();
  weekOutDate.setDate(weekOutDate.getDate() + 6);
  const weekOut = formatDate(weekOutDate);

  await Promise.all(
    allChildren.map((child) => generateAssignmentsFromSchedules(child.id, today, weekOut))
  );

  const perChild = await Promise.all(
    allChildren.map(async (child) => {
      const [todayAssignments, upcoming] = await Promise.all([
        getAssignmentsForDate(child.id, today),
        getAssignmentsForDateRange(child.id, today, weekOut),
      ]);
      return { child, todayAssignments, upcoming };
    })
  );

  const upcomingCombined = perChild
    .flatMap(({ child, upcoming }) =>
      upcoming
        .filter((a) => a.assignment.date >= today && a.assignment.status === "pending")
        .map((a) => ({ ...a, childName: child.displayName }))
    )
    .sort((a, b) => a.assignment.date.localeCompare(b.assignment.date))
    .slice(0, 8);

  return (
    <div className="hud-layout">
      <div className="page-banner text-center">
        <h1 className="page-title text-4xl">The Tavern</h1>
        <p className="mt-1 text-muted-foreground">Your family&apos;s adventure hub</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuicklinkCard href="/scrolls" icon="mage" label="Create Assignment" />
        <QuicklinkCard href="/schedule" icon="calendar" label="Manage Schedule" />
        <QuicklinkCard href="/loot" icon="gem" label="Review Loot" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {perChild.map(({ child, todayAssignments }) => (
          <ChildSummaryCard key={child.id} child={child} todayAssignments={todayAssignments} />
        ))}
      </div>

      <GameFrame title="Upcoming Quests" icon={<GameIcon name="scroll" className="size-4 text-[var(--gold-bright)]" />}>
        {upcomingCombined.length === 0 ? (
          <div className="py-4 text-center">
            <GameIcon name="scroll" className="mx-auto size-8 text-[var(--gold-bright)]" />
            <p className="mt-2 text-sm text-muted-foreground">Nothing scheduled beyond today.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingCombined.map((a) => (
              <div key={a.assignment.id} className="flex items-center justify-between text-sm">
                <span>
                  <span className="font-medium">{a.childName}</span> — {a.quest.title}
                  <span className="text-muted-foreground"> ({a.subject.name})</span>
                </span>
                <span className="text-xs text-muted-foreground">{a.assignment.date}</span>
              </div>
            ))}
          </div>
        )}
      </GameFrame>
    </div>
  );
}

function QuicklinkCard({
  href, icon, label,
}: {
  href: string; icon: GameIconName; label: string;
}) {
  return (
    <Link href={href}>
      <GameFrame className="transition-transform hover:-translate-y-0.5">
        <div className="flex items-center justify-center gap-2 py-2 text-center">
          <GameIcon name={icon} className="size-5 text-[var(--gold-bright)]" />
          <p className="font-medium">{label}</p>
        </div>
      </GameFrame>
    </Link>
  );
}

function ChildSummaryCard({
  child, todayAssignments,
}: {
  child: ChildRow;
  todayAssignments: Awaited<ReturnType<typeof getAssignmentsForDate>>;
}) {
  const level = Math.floor(child.currentXp / 100) + 1;
  const xpInLevel = child.currentXp % 100;
  const completed = todayAssignments.filter((a) => a.assignment.status === "completed").length;
  const total = todayAssignments.length;

  return (
    <GameFrame>
      <div className="flex items-start gap-3">
        <Avatar
          config={child.avatarConfig ? JSON.parse(child.avatarConfig) as AvatarConfig : null}
          name={child.displayName}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="font-brand text-lg font-bold" style={{ color: "var(--gold-bright)" }}>
            {child.displayName}
          </p>
          <p className="text-xs text-muted-foreground">Level {level} · {xpInLevel}/100 XP</p>
          <div className="xp-bar-track mt-1">
            <div className="xp-bar-fill" style={{ width: `${xpInLevel}%` }} />
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span style={{ color: "var(--streak)" }}>{child.currentStreak} day streak</span>
            <span>{total === 0 ? "No quests today" : `${completed}/${total} today`}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium">
        <Link href={`/quests?child=${child.id}`} className="text-primary hover:underline">
          Quest log →
        </Link>
        <Link href={`/scrolls?child=${child.id}`} className="text-primary hover:underline">
          Assign quests →
        </Link>
        <ViewAsHeroButton childId={child.id} childName={child.displayName} />
      </div>
    </GameFrame>
  );
}
