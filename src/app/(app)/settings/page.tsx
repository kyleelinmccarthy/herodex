import { getFamily } from "@/lib/actions/family";
import { getChildren } from "@/lib/actions/children";
import { getSubjects } from "@/lib/actions/subjects";
import { getChildBadges } from "@/lib/actions/badges";
import { getChildAvatarUnlocks } from "@/lib/actions/avatar";
import { getDemoPersona, isChildPersona, getChildIdForPersona } from "@/lib/auth/session";
import { FamilySetup } from "./family-setup";
import { ChildList } from "./child-list";

export default async function SettingsPage() {
  const family = await getFamily();
  const children = family ? await getChildren() : [];

  const isDemoMode = process.env.DEMO_MODE === "true";
  const persona = isDemoMode ? await getDemoPersona() : null;
  const isChildView = persona ? isChildPersona(persona) : false;
  const currentChildId = persona ? getChildIdForPersona(persona) : null;

  // Fetch subjects, badges, and avatar unlocks for each child
  const childrenWithSubjects = await Promise.all(
    children.map(async (child) => {
      const [subjects, earnedBadges, avatarUnlocks] = await Promise.all([
        getSubjects(child.id),
        getChildBadges(child.id),
        getChildAvatarUnlocks(child.id),
      ]);
      return {
        ...child,
        subjects,
        earnedBadgeIds: earnedBadges.map((b) => b.badge.id),
        questUnlockedItems: avatarUnlocks.map((u) => u.itemId),
      };
    })
  );

  return (
    <div className="space-y-8">
      <div className="page-banner">
        <h1 className="page-title text-3xl">The Hearth</h1>
        {family ? (
          <p className="text-lg text-muted-foreground">
            <span className="font-semibold text-foreground">{family.familyName}</span>
            {" "}&middot; {isChildView ? "My Chronicle" : "Family Settings"}
          </p>
        ) : (
          <p className="text-muted-foreground">Set up your family to get started.</p>
        )}
      </div>

      {family ? (
        <ChildList
          family={family}
          children={childrenWithSubjects}
          isChildView={isChildView}
          currentChildId={currentChildId}
        />
      ) : (
        <FamilySetup family={family} isChildView={isChildView} />
      )}
    </div>
  );
}
