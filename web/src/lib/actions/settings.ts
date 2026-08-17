"use server";

import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/data/membership";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./auth";
import type { Role, RolePermissionSet } from "@/lib/supabase/types";

export async function updateRolePermissions(
  role: Exclude<Role, "owner">,
  permissions: RolePermissionSet
): Promise<ActionResult> {
  const membership = await requireMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("role_permissions")
    .upsert(
      { company_id: membership.companyId, role, permissions },
      { onConflict: "company_id,role" }
    );

  if (error) {
    if (error.message.includes("permission denied") || error.message.includes("row-level security")) {
      return { ok: false, error: "이 작업을 수행할 권한이 없습니다.", code: "FORBIDDEN" };
    }
    return { ok: false, error: error.message, code: "UNKNOWN" };
  }

  revalidatePath("/settings/permissions");
  return { ok: true, data: undefined };
}

export async function resetRolePermissions(role: Exclude<Role, "owner">): Promise<ActionResult> {
  const membership = await requireMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("role_permissions")
    .delete()
    .eq("company_id", membership.companyId)
    .eq("role", role);

  if (error) {
    return { ok: false, error: error.message, code: "UNKNOWN" };
  }
  revalidatePath("/settings/permissions");
  return { ok: true, data: undefined };
}
