import * as XLSX from "xlsx";

// SERVICE_SPEC 6.1절: 대시보드/프로젝트목록 시트는 전체내역 시트를 참조하는
// 엑셀 수식으로 집계된다 (정적 숫자 캡처가 아님). v(캐시값)도 같이 넣어서
// 수식을 지원하지 않는 뷰어에서도 올바른 값이 보이게 한다.
//
// 주의: SUMIFS는 "프로젝트명" 기준으로 매칭한다. 프로젝트명 중복은 허용되므로
// (SERVICE_SPEC 3.2 — 경고만, 차단 아님) 동명 프로젝트가 있으면 합산이 섞일 수 있다.
// 이 내보내기는 보고/백업용 보조 도구이므로 1차에서는 이 한계를 감수한다.

export type ExportProject = {
  name: string;
  status: string;
  field: string | null;
  start_date: string | null;
  end_date: string | null;
  owner_name: string | null;
};

export type ExportTransaction = {
  tx_date: string;
  project_name: string;
  category: string;
  kind: "수익" | "비용";
  item_name: string | null;
  amount: number;
  currency: string;
  source: "manual" | "excel_upload";
  note: string | null;
};

function setFormulaCell(
  ws: XLSX.WorkSheet,
  addr: string,
  formula: string,
  cachedValue: number
) {
  ws[addr] = { t: "n", f: formula, v: cachedValue };
}

export function buildExportWorkbook(
  projects: ExportProject[],
  transactions: ExportTransaction[]
): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // ---- 3) 전체내역 (원본 데이터, 다른 시트가 참조) ----
  const txHeader = ["날짜", "프로젝트", "카테고리", "구분", "항목명", "금액", "통화", "출처", "비고"];
  const txRows = transactions.map((t) => [
    t.tx_date,
    t.project_name,
    t.category,
    t.kind,
    t.item_name ?? "",
    t.amount,
    t.currency,
    t.source === "excel_upload" ? "엑셀 업로드" : "직접 입력",
    t.note ?? "",
  ]);
  const txSheet = XLSX.utils.aoa_to_sheet([txHeader, ...txRows]);
  txSheet["!cols"] = [
    { wch: 11 }, { wch: 20 }, { wch: 14 }, { wch: 8 }, { wch: 20 },
    { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 24 },
  ];

  // ---- 2) 프로젝트목록 (매출/비용/순이익은 전체내역을 참조하는 SUMIFS 수식) ----
  const plHeader = ["프로젝트명", "상태", "분야", "시작일", "종료일", "담당자", "매출", "비용", "순이익"];
  const plRows = projects.map((p) => [
    p.name, p.status, p.field ?? "", p.start_date ?? "", p.end_date ?? "", p.owner_name ?? "", 0, 0, 0,
  ]);
  const plSheet = XLSX.utils.aoa_to_sheet([plHeader, ...plRows]);

  projects.forEach((p, i) => {
    const row = i + 2; // 1-indexed, header가 1행
    const revenue = transactions
      .filter((t) => t.project_name === p.name && t.kind === "수익")
      .reduce((s, t) => s + t.amount, 0);
    const cost = transactions
      .filter((t) => t.project_name === p.name && t.kind === "비용")
      .reduce((s, t) => s + t.amount, 0);

    setFormulaCell(
      plSheet,
      `G${row}`,
      `SUMIFS(전체내역!F:F,전체내역!B:B,A${row},전체내역!D:D,"수익")`,
      revenue
    );
    setFormulaCell(
      plSheet,
      `H${row}`,
      `SUMIFS(전체내역!F:F,전체내역!B:B,A${row},전체내역!D:D,"비용")`,
      cost
    );
    setFormulaCell(plSheet, `I${row}`, `G${row}-H${row}`, revenue - cost);
  });
  plSheet["!cols"] = [
    { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 11 }, { wch: 11 },
    { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];

  // ---- 1) 대시보드 (프로젝트목록 합계를 참조하는 수식) ----
  const totalRevenue = projects.reduce(
    (s, p) => s + transactions.filter((t) => t.project_name === p.name && t.kind === "수익").reduce((a, t) => a + t.amount, 0),
    0
  );
  const totalCost = projects.reduce(
    (s, p) => s + transactions.filter((t) => t.project_name === p.name && t.kind === "비용").reduce((a, t) => a + t.amount, 0),
    0
  );
  const net = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? net / totalRevenue : 0;
  const inProgress = projects.filter((p) => p.status === "진행중").length;
  const done = projects.filter((p) => p.status === "진행완료").length;

  const plLastRow = projects.length + 1;
  const dashAoa = [
    ["구분", "값"],
    ["총매출", 0],
    ["총비용", 0],
    ["순이익", 0],
    ["이익률", 0],
    ["진행중 프로젝트", 0],
    ["진행완료 프로젝트", 0],
  ];
  const dashSheet = XLSX.utils.aoa_to_sheet(dashAoa);
  setFormulaCell(dashSheet, "B2", `SUM(프로젝트목록!G2:G${plLastRow})`, totalRevenue);
  setFormulaCell(dashSheet, "B3", `SUM(프로젝트목록!H2:H${plLastRow})`, totalCost);
  setFormulaCell(dashSheet, "B4", `B2-B3`, net);
  setFormulaCell(dashSheet, "B5", `IFERROR(B4/B2,0)`, margin);
  setFormulaCell(dashSheet, "B6", `COUNTIF(프로젝트목록!B2:B${plLastRow},"진행중")`, inProgress);
  setFormulaCell(dashSheet, "B7", `COUNTIF(프로젝트목록!B2:B${plLastRow},"진행완료")`, done);
  dashSheet["!cols"] = [{ wch: 18 }, { wch: 16 }];
  dashSheet["B5"]!.z = "0.0%";

  XLSX.utils.book_append_sheet(wb, dashSheet, "대시보드");
  XLSX.utils.book_append_sheet(wb, plSheet, "프로젝트목록");
  XLSX.utils.book_append_sheet(wb, txSheet, "전체내역");

  // SheetJS의 type:"array" 옵션은 실제로는 ArrayBuffer를 반환한다 (Uint8Array 아님,
  // tsx/Node 환경에서 직접 확인함). Response 생성자는 ArrayBuffer를 그대로 받아들인다.
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
