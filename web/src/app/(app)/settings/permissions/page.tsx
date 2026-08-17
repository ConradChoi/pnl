import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMembership, getEffectivePermissions, can } from "@/lib/data/membership";
import { PermissionMatrixClient } from "./PermissionMatrixClient";

export default async function PermissionSettingsPage() {
  const membership = await requireMembership();
  const perms = await getEffectivePermissions(membership.companyId, membership.role);
  const allowed = membership.role === "owner" || can(perms, "company_settings");
  if (!allowed) redirect("/dashboard");

  const [adminPerms, teamLeadPerms, memberPerms] = await Promise.all([
    getEffectivePermissions(membership.companyId, "admin"),
    getEffectivePermissions(membership.companyId, "team_lead"),
    getEffectivePermissions(membership.companyId, "member"),
  ]);

  const supabase = await createClient();
  const { data: overrides } = await supabase
    .from("role_permissions")
    .select("role")
    .eq("company_id", membership.companyId);
  const customizedRoles = new Set((overrides ?? []).map((o) => o.role));

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">권한 매트릭스 설정</h1>
      <p className="mb-4 text-xs text-muted">
        오너는 항상 전권을 가지며 여기서 수정할 수 없습니다. 나머지 role은 회사 단위로
        커스텀할 수 있고, 다른 회사에는 영향을 주지 않습니다.
      </p>
      <PermissionMatrixClient
        initial={{
          admin: adminPerms === "owner" ? null : adminPerms,
          team_lead: teamLeadPerms === "owner" ? null : teamLeadPerms,
          member: memberPerms === "owner" ? null : memberPerms,
        }}
        customizedRoles={[...customizedRoles] as ("admin" | "team_lead" | "member")[]}
      />
    </div>
  );
}
