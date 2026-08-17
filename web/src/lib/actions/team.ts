"use server";

import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/data/membership";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./auth";
import type { Role } from "@/lib/supabase/types";

function friendlyError(message: string): { error: string; code: string } {
  if (message.includes("permission denied") || message.includes("42501") || message.includes("row-level security")) {
    return { error: "이 작업을 수행할 권한이 없습니다.", code: "FORBIDDEN" };
  }
  if (message.includes("duplicate") || message.includes("23505")) {
    return { error: "이미 초대되었거나 소속된 이메일입니다.", code: "ALREADY_MEMBER" };
  }
  if (message.includes("최소 1명의 오너")) {
    return { error: message, code: "LAST_OWNER" };
  }
  return { error: message, code: "UNKNOWN" };
}

export async function createTeam(
  _prevState: ActionResult<string> | null,
  formData: FormData
): Promise<ActionResult<string>> {
  const membership = await requireMembership();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "팀 이름을 입력해주세요.", code: "VALIDATION_ERROR" };

  const { data, error } = await supabase
    .from("teams")
    .insert({ company_id: membership.companyId, name })
    .select("id")
    .single();

  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }
  revalidatePath("/team");
  return { ok: true, data: data.id };
}

// ⚠️ 실제 이메일 발송 로직은 아직 없다 (Resend 등 외부 이메일 서비스 연동 필요, 2차 과제).
// 지금은 초대 링크를 화면에 노출해서 초대자가 직접 전달하는 방식으로 대체한다.
export async function inviteMember(
  _prevState: ActionResult<string> | null,
  formData: FormData
): Promise<ActionResult<string>> {
  const membership = await requireMembership();
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") as Exclude<Role, "owner">;
  const teamId = (formData.get("team_id") as string) || null;

  if (!email || !role) {
    return { ok: false, error: "이메일과 role을 선택해주세요.", code: "VALIDATION_ERROR" };
  }

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      company_id: membership.companyId,
      email,
      role,
      team_id: teamId,
      invited_by: membership.userId,
    })
    .select("token")
    .single();

  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }

  revalidatePath("/team");
  return { ok: true, data: data.token };
}

export async function cancelInvitation(invitationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("invitations")
    .update({ status: "canceled" })
    .eq("id", invitationId);

  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }
  revalidatePath("/team");
  return { ok: true, data: undefined };
}

export async function resendInvitation(invitationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("invitations")
    .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
    .eq("id", invitationId)
    .eq("status", "pending");

  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }
  revalidatePath("/team");
  return { ok: true, data: undefined };
}

export async function updateMemberRole(membershipId: string, role: Role): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").update({ role }).eq("id", membershipId);

  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }
  revalidatePath("/team");
  return { ok: true, data: undefined };
}

export async function deactivateMember(membershipId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ status: "inactive" })
    .eq("id", membershipId);

  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }
  revalidatePath("/team");
  return { ok: true, data: undefined };
}
