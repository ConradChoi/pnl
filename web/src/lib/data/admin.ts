import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { PlatformAdminRole } from "@/lib/supabase/types";

export type PlatformAdminSession = {
  userId: string;
  email: string;
  role: PlatformAdminRole;
  canViewAuditLog: boolean;
};

// ADMIN 백오피스 전용 가드. requireMembership()과 별개 — 회사 소속과 무관하며,
// platform_admins에 등록된 계정만 통과한다 (등록 자체는 앱에 없음, Supabase 콘솔 전용).
export async function requirePlatformAdmin(): Promise<PlatformAdminSession> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login?next=/admin");

  const { data: admin } = await supabase
    .from("platform_admins")
    .select("role, can_view_audit_log")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) redirect("/dashboard");

  return {
    userId: user.id,
    email: user.email!,
    role: admin.role,
    canViewAuditLog: admin.role === "super_admin" || admin.can_view_audit_log,
  };
}
