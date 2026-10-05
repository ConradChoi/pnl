import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/data/membership";
import { buildExportWorkbook, type ExportProject, type ExportTransaction } from "@/lib/excel/buildExportWorkbook";

// SERVICE_SPEC 6.1절: 대시보드 "엑셀 다운로드" — 필터와 무관하게 회사 전체 기간 데이터를
// 3개 시트(대시보드/프로젝트목록/전체내역, 시트 간 수식 연결)로 내보낸다.
export async function GET() {
  const membership = await requireMembership();
  const supabase = await createClient();

  const [{ data: projects }, { data: transactions }] = await Promise.all([
    supabase
      .from("projects")
      .select("name, status, field, start_date, end_date, owner_name")
      .order("created_at", { ascending: true }),
    supabase
      .from("transactions")
      .select("tx_date, category, kind, item_name, amount, currency, source, note, projects(name)")
      .order("tx_date", { ascending: true }),
  ]);

  const exportProjects: ExportProject[] = projects ?? [];
  const exportTransactions: ExportTransaction[] = (
    (transactions ?? []) as unknown as Array<{
      tx_date: string;
      category: string;
      kind: "수익" | "비용";
      item_name: string | null;
      amount: number;
      currency: string;
      source: "manual" | "excel_upload";
      note: string | null;
      projects: { name: string } | null;
    }>
  ).map((t) => ({
    tx_date: t.tx_date,
    project_name: t.projects?.name ?? "—",
    category: t.category,
    kind: t.kind,
    item_name: t.item_name,
    amount: t.amount,
    currency: t.currency,
    source: t.source,
    note: t.note,
  }));

  const bytes = buildExportWorkbook(exportProjects, exportTransactions);
  const fileName = `PNL_${membership.companyName}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  // 회사명이 한글일 수 있어 RFC 5987(filename*=UTF-8''...)로 인코딩 — ASCII fallback도 함께 제공
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, "_");

  return new Response(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
