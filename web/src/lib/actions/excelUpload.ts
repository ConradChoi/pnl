"use server";

import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/data/membership";
import { revalidatePath } from "next/cache";
import type { TxKind } from "@/lib/supabase/types";

export type ParsedRow = {
  projectName: string;
  txDate: string; // yyyy-mm-dd
  category: string;
  kind: TxKind;
  itemName: string;
  amount: number;
  currency: string;
  note: string;
};

export type PreviewedRow = ParsedRow & {
  isNewProject: boolean;
  isDuplicateSuspect: boolean;
};

export type PreviewResult =
  | { ok: true; rows: PreviewedRow[]; newProjectNames: string[] }
  | { ok: false; error: string; code: string };

// SERVICE_SPEC 4.1 3단계: 서버가 기존 거래내역과 대조해 중복 의심 판정.
// (BACKEND_DESIGN.md 7절 쿼리를 배치용으로 확장 — 행마다 쿼리하지 않고 한 번에 조회)
export async function previewExcelUpload(rows: ParsedRow[]): Promise<PreviewResult> {
  if (rows.length === 0) {
    return { ok: false, error: "파싱된 거래내역이 없습니다.", code: "EMPTY_FILE" };
  }

  const membership = await requireMembership();
  const supabase = await createClient();

  const { data: existingProjects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("company_id", membership.companyId);
  const projectIdByName = new Map((existingProjects ?? []).map((p) => [p.name, p.id]));

  const existingProjectIds = [...projectIdByName.values()];
  const { data: existingTx } = existingProjectIds.length
    ? await supabase
        .from("transactions")
        .select("project_id, tx_date, category, amount, item_name")
        .eq("company_id", membership.companyId)
        .in("project_id", existingProjectIds)
    : { data: [] as { project_id: string; tx_date: string; category: string; amount: number; item_name: string | null }[] };

  const dupKey = (projectId: string, txDate: string, category: string, amount: number, itemName: string) =>
    `${projectId}|${txDate}|${category}|${amount}|${itemName}`;
  const existingKeySet = new Set(
    (existingTx ?? []).map((t) => dupKey(t.project_id, t.tx_date, t.category, t.amount, t.item_name ?? ""))
  );

  const newProjectNames = new Set<string>();
  const previewedRows: PreviewedRow[] = rows.map((row) => {
    const projectId = projectIdByName.get(row.projectName);
    const isNewProject = !projectId;
    if (isNewProject) newProjectNames.add(row.projectName);

    const isDuplicateSuspect =
      !isNewProject &&
      existingKeySet.has(dupKey(projectId!, row.txDate, row.category, row.amount, row.itemName));

    return { ...row, isNewProject, isDuplicateSuspect };
  });

  return { ok: true, rows: previewedRows, newProjectNames: [...newProjectNames] };
}

export type CommitResult =
  | {
      ok: true;
      batchId: string;
      saved: number;
      excluded: number;
      errors: { row: number; reason: string }[];
    }
  | { ok: false; error: string; code: string };

export async function commitExcelUpload(
  fileName: string,
  totalParsedRows: number,
  selectedRows: PreviewedRow[]
): Promise<CommitResult> {
  const membership = await requireMembership();
  const supabase = await createClient();

  const { data: batch, error: batchError } = await supabase
    .from("upload_batches")
    .insert({
      company_id: membership.companyId,
      uploaded_by: membership.userId,
      file_name: fileName,
      total_rows: totalParsedRows,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return { ok: false, error: "업로드 배치 생성에 실패했습니다.", code: "BATCH_FAILED" };
  }

  // 커밋 시점에 프로젝트 존재 여부를 다시 확인/생성 (프리뷰 이후 시간차로 인한 stale 방지)
  const { data: existingProjects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("company_id", membership.companyId);
  const projectIdByName = new Map((existingProjects ?? []).map((p) => [p.name, p.id]));

  const errors: { row: number; reason: string }[] = [];
  let saved = 0;

  for (let i = 0; i < selectedRows.length; i++) {
    const row = selectedRows[i];
    let projectId = projectIdByName.get(row.projectName);

    if (!projectId) {
      const { data: created, error: createErr } = await supabase
        .from("projects")
        .insert({
          company_id: membership.companyId,
          name: row.projectName,
          team_id: membership.teamId,
          created_by: membership.userId,
        })
        .select("id")
        .single();

      if (createErr || !created) {
        errors.push({ row: i + 1, reason: `프로젝트 "${row.projectName}" 생성 권한이 없습니다.` });
        continue;
      }
      projectId = created.id;
      projectIdByName.set(row.projectName, projectId);
    }

    const { error: txError } = await supabase.from("transactions").insert({
      company_id: membership.companyId,
      project_id: projectId,
      tx_date: row.txDate,
      category: row.category,
      kind: row.kind,
      item_name: row.itemName || null,
      amount: row.amount,
      currency: row.currency || "KRW",
      note: row.note || null,
      source: "excel_upload",
      upload_batch_id: batch.id,
      created_by: membership.userId,
    });

    if (txError) {
      errors.push({ row: i + 1, reason: txError.message.includes("permission") ? "권한이 없습니다." : txError.message });
      continue;
    }

    saved += 1;
  }

  const excluded = totalParsedRows - selectedRows.length;

  await supabase
    .from("upload_batches")
    .update({ saved_rows: saved, excluded_rows: excluded, error_rows: errors.length })
    .eq("id", batch.id);

  revalidatePath("/projects");

  return { ok: true, batchId: batch.id, saved, excluded, errors };
}
