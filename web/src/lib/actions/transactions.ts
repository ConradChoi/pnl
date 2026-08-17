"use server";

import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/data/membership";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./auth";
import type { TxKind } from "@/lib/supabase/types";

function friendlyError(message: string): { error: string; code: string } {
  if (message.includes("permission denied") || message.includes("42501") || message.includes("row-level security")) {
    return { error: "이 작업을 수행할 권한이 없습니다.", code: "FORBIDDEN" };
  }
  if (message.includes("check constraint") && message.includes("amount")) {
    return { error: "금액은 0이 될 수 없습니다.", code: "VALIDATION_ERROR" };
  }
  return { error: message, code: "UNKNOWN" };
}

export async function createTransaction(
  projectId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const membership = await requireMembership();
  const supabase = await createClient();

  const txDate = String(formData.get("tx_date") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const kind = formData.get("kind") as TxKind;
  const amountRaw = Number(formData.get("amount"));

  if (!txDate || !category || !kind) {
    return { ok: false, error: "날짜/카테고리/구분은 필수입니다.", code: "VALIDATION_ERROR" };
  }
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
    return { ok: false, error: "금액은 0보다 큰 숫자여야 합니다.", code: "VALIDATION_ERROR" };
  }

  const { error } = await supabase.from("transactions").insert({
    company_id: membership.companyId,
    project_id: projectId,
    tx_date: txDate,
    category,
    kind,
    item_name: (formData.get("item_name") as string) || null,
    amount: amountRaw,
    currency: (formData.get("currency") as string) || "KRW",
    note: (formData.get("note") as string) || null,
    source: "manual",
    created_by: membership.userId,
  });

  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, data: undefined };
}

export async function updateTransaction(
  transactionId: string,
  projectId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const amountRaw = Number(formData.get("amount"));
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
    return { ok: false, error: "금액은 0보다 큰 숫자여야 합니다.", code: "VALIDATION_ERROR" };
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      tx_date: String(formData.get("tx_date") ?? ""),
      category: String(formData.get("category") ?? "").trim(),
      kind: formData.get("kind") as TxKind,
      item_name: (formData.get("item_name") as string) || null,
      amount: amountRaw,
      currency: (formData.get("currency") as string) || "KRW",
      note: (formData.get("note") as string) || null,
    })
    .eq("id", transactionId);

  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, data: undefined };
}

// SERVICE_SPEC 3.1: team_lead 이상 즉시 삭제 (RLS가 최종 판단).
export async function deleteTransaction(
  transactionId: string,
  projectId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", transactionId);

  if (error) {
    const { error: msg, code } = friendlyError(error.message);
    return { ok: false, error: msg, code };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, data: undefined };
}

export async function requestTransactionDeletion(
  transactionId: string,
  projectId: string,
  reason: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_deletion", {
    p_project_id: null,
    p_transaction_id: transactionId,
    p_reason: reason,
  });

  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505") {
      return { ok: false, error: "이미 승인 대기 중인 삭제 요청이 있습니다.", code: "ALREADY_PENDING" };
    }
    return { ok: false, error: error.message, code: "REQUEST_FAILED" };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, data: undefined };
}
