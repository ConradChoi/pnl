"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./auth";

export async function decideDeletionRequest(
  requestId: string,
  approve: boolean,
  decisionReason: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_deletion_request", {
    p_request_id: requestId,
    p_approve: approve,
    p_decision_reason: decisionReason || null,
  });

  if (error) {
    if (error.message.includes("본인이 요청한")) {
      return { ok: false, error: error.message, code: "SELF_APPROVAL_FORBIDDEN" };
    }
    if (error.message.includes("대기중인 요청")) {
      return { ok: false, error: "이미 처리된 요청입니다.", code: "NOT_FOUND" };
    }
    return { ok: false, error: error.message, code: "DECIDE_FAILED" };
  }

  revalidatePath("/deletion-requests");
  revalidatePath("/projects");
  return { ok: true, data: undefined };
}
