"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/data/admin";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./auth";

function friendlyError(message: string): { error: string; code: string } {
  if (message.includes("permission denied") || message.includes("row-level security")) {
    return { error: "운영자 권한이 필요합니다.", code: "FORBIDDEN" };
  }
  return { error: message, code: "UNKNOWN" };
}

export async function updatePlatformSettings(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requirePlatformAdmin();
  const supabase = await createClient();

  const field = (name: string) => (formData.get(name) as string) || null;

  const { error } = await supabase
    .from("platform_settings")
    .update({
      business_name: field("business_name"),
      representative_name: field("representative_name"),
      business_registration_number: field("business_registration_number"),
      business_address: field("business_address"),
      support_email: field("support_email"),
      support_phone: field("support_phone"),
      dpo_name: field("dpo_name"),
      dpo_contact: field("dpo_contact"),
      company_withdrawal_policy: field("company_withdrawal_policy"),
      updated_by: admin.userId,
    })
    .eq("id", true);

  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/privacy");
  return { ok: true, data: undefined };
}

export async function upsertNotice(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requirePlatformAdmin();
  const supabase = await createClient();

  const id = (formData.get("id") as string) || null;
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const isPublished = formData.get("is_published") === "on";

  if (!title || !content) {
    return { ok: false, error: "제목과 내용을 입력해주세요.", code: "VALIDATION_ERROR" };
  }

  const { error } = id
    ? await supabase.from("notices").update({ title, content, is_published: isPublished }).eq("id", id)
    : await supabase.from("notices").insert({ title, content, is_published: isPublished, created_by: admin.userId });

  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }

  revalidatePath("/admin/notices");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

export async function deleteNotice(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("notices").delete().eq("id", id);
  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }
  revalidatePath("/admin/notices");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

export async function upsertFaq(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requirePlatformAdmin();
  const supabase = await createClient();

  const id = (formData.get("id") as string) || null;
  const question = String(formData.get("question") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();
  const category = (formData.get("category") as string) || null;
  const isPublished = formData.get("is_published") === "on";

  if (!question || !answer) {
    return { ok: false, error: "질문과 답변을 입력해주세요.", code: "VALIDATION_ERROR" };
  }

  const { error } = id
    ? await supabase.from("faqs").update({ question, answer, category, is_published: isPublished }).eq("id", id)
    : await supabase
        .from("faqs")
        .insert({ question, answer, category, is_published: isPublished, created_by: admin.userId });

  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }

  revalidatePath("/admin/faqs");
  return { ok: true, data: undefined };
}

export async function deleteFaq(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("faqs").delete().eq("id", id);
  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }
  revalidatePath("/admin/faqs");
  return { ok: true, data: undefined };
}
