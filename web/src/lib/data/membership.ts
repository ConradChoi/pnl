import { createClient } from "@/lib/supabase/server";
import type { Role, RolePermissionSet } from "@/lib/supabase/types";
import { redirect } from "next/navigation";

export type CurrentMembership = {
  userId: string;
  email: string;
  displayName: string | null;
  companyId: string;
  companyName: string;
  role: Role;
  teamId: string | null;
  isRepresentative: boolean;
};

// PRD 5.1 기본값 — role_permissions에 회사별 커스텀 row가 없을 때 폴백.
// SQL의 default_permissions()와 반드시 동일하게 유지해야 한다.
const DEFAULT_PERMISSIONS: Record<Exclude<Role, "owner">, RolePermissionSet> = {
  admin: {
    project_create: true,
    project_update: true,
    project_delete: true,
    transaction_create: true,
    transaction_update: true,
    transaction_delete: true,
    excel_upload: true,
    invite_member: true,
    company_settings: true,
  },
  team_lead: {
    project_create: true,
    project_update: true,
    project_delete: true,
    transaction_create: true,
    transaction_update: true,
    transaction_delete: true,
    excel_upload: true,
    invite_member: true,
    company_settings: false,
  },
  member: {
    project_create: false,
    project_update: false,
    project_delete: false,
    transaction_create: true,
    transaction_update: true,
    transaction_delete: false,
    excel_upload: true,
    invite_member: false,
    company_settings: false,
  },
};

// 로그인 필수 페이지에서 호출. 세션/멤버십이 없으면 로그인으로 보낸다.
// 실제 CRUD 허용 여부는 항상 DB(RLS/has_permission)가 최종 판단하므로,
// 여기서 만드는 permissions는 "버튼을 보여줄지 말지" 결정하는 UI 편의용일 뿐이다.
export async function requireMembership(): Promise<CurrentMembership> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("company_id, role, team_id, is_representative, companies(name)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) redirect("/login?error=소속된 회사가 없습니다");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const companies = membership.companies as unknown as { name: string } | null;

  return {
    userId: user.id,
    email: user.email!,
    displayName: profile?.display_name ?? null,
    companyId: membership.company_id,
    companyName: companies?.name ?? "",
    role: membership.role,
    teamId: membership.team_id,
    isRepresentative: membership.is_representative,
  };
}

export async function getEffectivePermissions(
  companyId: string,
  role: Role
): Promise<RolePermissionSet | "owner"> {
  if (role === "owner") return "owner";

  const supabase = await createClient();
  const { data } = await supabase
    .from("role_permissions")
    .select("permissions")
    .eq("company_id", companyId)
    .eq("role", role)
    .maybeSingle();

  return (data?.permissions as RolePermissionSet | undefined) ?? DEFAULT_PERMISSIONS[role];
}

export function can(perms: RolePermissionSet | "owner", key: keyof RolePermissionSet): boolean {
  return perms === "owner" || perms[key];
}
