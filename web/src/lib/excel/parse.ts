import type { ParsedRow } from "@/lib/actions/excelUpload";

// 기존 P&L 온라인 대시보드.html의 클라이언트 파싱 로직을 계승 (SERVICE_SPEC 4.1).
// 서버는 이 결과(JSON)만 받는다 — 원본 파일 자체를 서버에서 재파싱하지 않는다
// (SECURITY_REVIEW.md 주요4: 서버측 파일 파싱은 리스크가 다르므로 범위를 최소화).

const EXAMPLE_NOTE = "예시 - 실제 데이터로 교체하세요";
const MAX_ROWS = 5000; // SECURITY_REVIEW.md 주요4 — 업로드 행수 상한

export type ParseOutcome = {
  rows: ParsedRow[];
  skipped: number;
  error?: string;
};

function toDateString(value: unknown): string | null {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

export async function parseWorkbookFile(file: File): Promise<ParseOutcome> {
  if (!file.name.toLowerCase().endsWith(".xlsx") && !file.name.toLowerCase().endsWith(".xlsm")) {
    return { rows: [], skipped: 0, error: "xlsx 또는 xlsm 파일만 업로드할 수 있습니다." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { rows: [], skipped: 0, error: "파일 크기는 10MB를 초과할 수 없습니다." };
  }

  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });

  const txSheet = wb.Sheets["거래내역"];
  if (!txSheet) {
    return { rows: [], skipped: 0, error: "'거래내역' 시트를 찾을 수 없습니다. 제공된 템플릿 형식을 확인해주세요." };
  }

  const txRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(txSheet, { defval: "" });

  const rows: ParsedRow[] = [];
  let skipped = 0;

  for (const r of txRows.slice(0, MAX_ROWS)) {
    const projectName = String(r["프로젝트명"] ?? "").trim();
    const category = String(r["카테고리"] ?? "").trim();
    const kindRaw = String(r["구분"] ?? "").trim();
    const amount = Number(r["금액(원)"]) || 0;
    const note = String(r["비고"] ?? "").trim();

    if (!projectName || !category || !kindRaw || !amount) {
      skipped++;
      continue;
    }
    if (note === EXAMPLE_NOTE) {
      skipped++;
      continue;
    }

    const txDate = toDateString(r["날짜"]);
    if (!txDate) {
      skipped++;
      continue;
    }

    const kind = kindRaw === "수익" || kindRaw === "비용" ? kindRaw : amount >= 0 ? "비용" : "수익";

    rows.push({
      projectName,
      txDate,
      category,
      kind,
      itemName: String(r["항목명"] ?? "").trim(),
      amount: Math.abs(amount),
      currency: String(r["통화"] ?? "KRW").trim() || "KRW",
      note,
    });
  }

  return { rows, skipped };
}
