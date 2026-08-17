"use server";

import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/data/membership";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "./auth";
import type { ProjectStatus } from "@/lib/supabase/types";

function friendlyError(message: string): { error: string; code: string } {
  // RLS 위반은 Postgres 에러코드 42501(insufficient_privilege) 또는 "permission denied"류로 온다.
  if (message.includes("permission denied") || message.includes("42501") || message.includes("row-level security")) {
    return { error: "이 작업을 수행할 권한이 없습니다.", code: "FORBIDDEN" };
  }
  return { error: message, code: "UNKNOWN" };
}

export async function createProject(
  _prevState: ActionResult<string> | null,
  formData: FormData
): Promise<ActionResult<string>> {
  const membership = await requireMembership();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "프로젝트명을 입력해주세요.", code: "VALIDATION_ERROR" };

  const { data, error } = await supabase
    .from("projects")
    .insert({
      company_id: membership.companyId,
      name,
      status: (formData.get("status") as ProjectStatus) || "진행중",
      field: (formData.get("field") as string) || null,
      start_date: (formData.get("start_date") as string) || null,
      end_date: (formData.get("end_date") as string) || null,
      owner_name: (formData.get("owner_name") as string) || null,
      note: (formData.get("note") as string) || null,
      team_id: membership.teamId, // 팀 대표/팀원이 만들면 자기 팀 소속으로, 오너/관리자는 null(전사 공용) 가능
      created_by: membership.userId,
    })
    .select("id")
    .single();

  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(
  projectId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "프로젝트명을 입력해주세요.", code: "VALIDATION_ERROR" };

  const { error } = await supabase
    .from("projects")
    .update({
      name,
      status: (formData.get("status") as ProjectStatus) || "진행중",
      field: (formData.get("field") as string) || null,
      start_date: (formData.get("start_date") as string) || null,
      end_date: (formData.get("end_date") as string) || null,
      owner_name: (formData.get("owner_name") as string) || null,
      note: (formData.get("note") as string) || null,
    })
    .eq("id", projectId);

  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, data: undefined };
}

// SERVICE_SPEC 3.1: team_lead 이상은 즉시 삭제(RLS가 최종 판단), member는 이 액션을 호출하지 않고
// requestDeletion을 대신 호출한다(화면에서 role로 분기 — 아래 requestDeletion 참고).
export async function deleteProject(projectId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);

  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }

  revalidatePath("/projects");
  return { ok: true, data: undefined };
}

export async function requestProjectDeletion(
  projectId: string,
  reason: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_deletion", {
    p_project_id: projectId,
    p_transaction_id: null,
    p_reason: reason,
  });

  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505") {
      return { ok: false, error: "이미 승인 대기 중인 삭제 요청이 있습니다.", code: "ALREADY_PENDING" };
    }
    return { ok: false, error: error.message, code: "REQUEST_FAILED" };
  }

  revalidatePath("/projects");
  return { ok: true, data: undefined };
}
