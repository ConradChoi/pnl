import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/data/membership";
import { redirect } from "next/navigation";
import { TeamManagementClient, type MembershipRow } from "./TeamManagementClient";

export default async function TeamPage() {
  const membership = await requireMembership();
  if (membership.role === "member") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: memberships }, { data: invitations }, { data: teams }] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, user_id, role, team_id, is_representative, status, profiles(display_name, email)"),
    supabase
      .from("invitations")
      .select("id, email, role, team_id, status, expires_at, token")
      .order("created_at", { ascending: false }),
    supabase.from("teams").select("id, name"),
  ]);

  return (
    <TeamManagementClient
      currentUserId={membership.userId}
      currentUserRole={membership.role}
      currentUserTeamId={membership.teamId}
      memberships={(memberships ?? []) as unknown as MembershipRow[]}
      invitations={invitations ?? []}
      teams={teams ?? []}
    />
  );
}
