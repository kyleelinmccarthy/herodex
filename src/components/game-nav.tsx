"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/user-menu";

const MAIN_NAV: { href: string; label: string; icon: string; parentOnly?: boolean }[] = [
  { href: "/tavern", label: "Tavern", icon: "🏘️" },
  { href: "/quests", label: "Quest Log", icon: "📜" },
  { href: "/scrolls", label: "Planner", icon: "📖", parentOnly: true },
  { href: "/loot", label: "Loot", icon: "💎" },
  { href: "/leaderboard", label: "Ranks", icon: "🏆" },
];


function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavMedallion({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "medallion",
        active && "medallion--active",
      )}
    >
      <span className="medallion-icon" role="img" aria-hidden="true">
        {icon}
      </span>
      <span className="medallion-label">{label}</span>
    </Link>
  );
}

export function GameBanner() {
  return (
    <div className="game-banner">
      <div className="game-banner-inner">
        <Link href="/tavern" className="game-banner-link">
          <img src="/crown.svg" alt="" className="game-banner-logo" aria-hidden="true" />
          <span className="game-banner-title">HeroDex</span>
          <span className="game-banner-subtitle">Be the Hero of Homeschool</span>
        </Link>
      </div>
    </div>
  );
}

export function GameNavBar({ userName, isChildView }: { userName: string; isChildView?: boolean }) {
  const pathname = usePathname();

  const navItems = isChildView
    ? MAIN_NAV.filter((item) => !item.parentOnly)
    : MAIN_NAV;

  return (
    <nav className="game-navbar">
      <div className="game-navbar-inner">
        <div className="game-navbar-corner game-navbar-corner--tl" />
        <div className="game-navbar-corner game-navbar-corner--tr" />
        <div className="game-navbar-corner game-navbar-corner--bl" />
        <div className="game-navbar-corner game-navbar-corner--br" />

        <div className="game-navbar-main">
          {navItems.map((item) => (
            <NavMedallion
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(pathname, item.href)}
            />
          ))}
        </div>

        <div className="game-navbar-end">
          <UserMenu userName={userName} />
        </div>
      </div>
    </nav>
  );
}
