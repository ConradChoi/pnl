import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/data/membership";
import { Card } from "@/components/ui/Card";
import { DashboardCharts } from "./DashboardCharts";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

type TxRow = {
  id: string;
  tx_date: string;
  category: string;
  kind: "수익" | "비용";
  item_name: string | null;
  amount: number;
  project_id: string;
  projects: { id: string; name: string; status: string } | null;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; status?: string; q?: string; sort?: string; dir?: string }>;
}) {
  const { year, status, q, sort = "net", dir = "desc" } = await searchParams;
  await requireMembership();
  const supabase = await createClient();

  const [{ data: notices }, { data: projects }] = await Promise.all([
    supabase
      .from("notices")
      .select("id, title, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(3),
    supabase.from("projects").select("id, name, status"),
  ]);

  // 연도/상태/검색이 모두 반영된 거래내역 (KPI, 프로젝트별 순이익, 비용 구성, 테이블용)
  let txQuery = supabase
    .from("transactions")
    .select("id, tx_date, category, kind, item_name, amount, project_id, projects(id, name, status)");
  if (year && year !== "전체") {
    txQuery = txQuery.gte("tx_date", `${year}-01-01`).lte("tx_date", `${year}-12-31`);
  }
  const { data: txRaw } = await txQuery;
  let transactions = (txRaw ?? []) as unknown as TxRow[];
  if (status && status !== "전체") {
    transactions = transactions.filter((t) => t.projects?.status === status);
  }
  if (q) {
    transactions = transactions.filter((t) => t.projects?.name.includes(q));
  }

  // 연도별 추이는 "연도 필터와 무관하게 전체 기간" — 상태/검색만 반영 (SERVICE_SPEC 6절)
  const trendQuery = supabase
    .from("transactions")
    .select("tx_date, kind, amount, projects(name, status)");
  const { data: trendRaw } = await trendQuery;
  let trendTx = (trendRaw ?? []) as unknown as { tx_date: string; kind: "수익" | "비용"; amount: number; projects: { name: string; status: string } | null }[];
  if (status && status !== "전체") trendTx = trendTx.filter((t) => t.projects?.status === status);
  if (q) trendTx = trendTx.filter((t) => t.projects?.name.includes(q));

  // KPI
  const revenue = transactions.filter((t) => t.kind === "수익").reduce((s, t) => s + t.amount, 0);
  const cost = transactions.filter((t) => t.kind === "비용").reduce((s, t) => s + t.amount, 0);
  const net = revenue - cost;
  const margin = revenue > 0 ? net / revenue : 0;
  const inProgressCount = (projects ?? []).filter((p) => p.status === "진행중").length;
  const doneCount = (projects ?? []).filter((p) => p.status === "진행완료").length;

  // 프로젝트별 순이익
  const byProject = new Map<string, { name: string; revenue: number; cost: number }>();
  for (const t of transactions) {
    const key = t.project_id;
    const entry = byProject.get(key) ?? { name: t.projects?.name ?? "—", revenue: 0, cost: 0 };
    if (t.kind === "수익") entry.revenue += t.amount;
    else entry.cost += t.amount;
    byProject.set(key, entry);
  }
  const projectNetData = [...byProject.values()]
    .map((p) => ({ name: p.name, net: p.revenue - p.cost }))
    .sort((a, b) => b.net - a.net);

  // 비용 카테고리 구성
  const byCategory = new Map<string, number>();
  for (const t of transactions) {
    if (t.kind !== "비용") continue;
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
  }
  const costCategoryData = [...byCategory.entries()].map(([name, value]) => ({ name, value }));

  // 연도별 추이
  const byYear = new Map<string, { revenue: number; cost: number }>();
  for (const t of trendTx) {
    const y = t.tx_date.slice(0, 4);
    const entry = byYear.get(y) ?? { revenue: 0, cost: 0 };
    if (t.kind === "수익") entry.revenue += t.amount;
    else entry.cost += t.amount;
    byYear.set(y, entry);
  }
  const trendData = [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, v]) => ({ year, 매출: v.revenue, 비용: v.cost, 순이익: v.revenue - v.cost }));

  // 상세 테이블 (정렬 가능)
  const sortableRows = transactions.map((t) => ({
    id: t.id,
    date: t.tx_date,
    project: t.projects?.name ?? "—",
    category: t.category,
    kind: t.kind,
    item: t.item_name ?? "—",
    amount: t.kind === "수익" ? t.amount : -t.amount,
  }));
  const sortKeyMap: Record<string, (r: (typeof sortableRows)[number]) => string | number> = {
    date: (r) => r.date,
    project: (r) => r.project,
    amount: (r) => r.amount,
    net: (r) => r.amount,
  };
  const sorted = [...sortableRows].sort((a, b) => {
    const ka = sortKeyMap[sort]?.(a) ?? a.date;
    const kb = sortKeyMap[sort]?.(b) ?? b.date;
    const cmp = ka < kb ? -1 : ka > kb ? 1 : 0;
    return dir === "asc" ? cmp : -cmp;
  });

  const years = [...new Set((trendRaw ?? []).map((t) => (t as { tx_date: string }).tx_date.slice(0, 4)))].sort();

  return (
    <div>
      {notices && notices.length > 0 && (
        <Card className="mb-4">
          <p className="mb-2 text-xs font-semibold text-muted">공지사항</p>
          <ul className="flex flex-col gap-1 text-sm">
            {notices.map((n) => (
              <li key={n.id} className="flex justify-between">
                <span>{n.title}</span>
                <span className="text-xs text-muted">
                  {new Date(n.published_at).toLocaleDateString("ko-KR")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <select name="year" defaultValue={year ?? "전체"} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs">
          <option value="전체">전체 연도</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? "전체"} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs">
          {["전체", "진행중", "진행완료", "진행예정"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input name="q" defaultValue={q ?? ""} placeholder="프로젝트명 검색" className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs" />
        <button className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-accent">필터 적용</button>
      </form>

      {transactions.length === 0 ? (
        <Card className="text-center text-sm text-muted">
          표시할 데이터가 없습니다.{" "}
          <Link href="/projects/new" className="text-accent underline">
            거래내역을 입력
          </Link>
          하거나{" "}
          <Link href="/upload" className="text-accent underline">
            엑셀을 업로드
          </Link>
          해보세요.
        </Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="총매출" value={`${fmt(revenue)}원`} />
            <Kpi label="총비용" value={`${fmt(cost)}원`} />
            <Kpi label="순이익" value={`${fmt(net)}원`} tone={net >= 0 ? "pos" : "neg"} />
            <Kpi label="이익률" value={fmtPct(margin)} tone={margin >= 0 ? "pos" : "neg"} />
            <Kpi label="진행중 프로젝트" value={`${inProgressCount}개`} />
            <Kpi label="진행완료 프로젝트" value={`${doneCount}개`} />
          </div>

          <DashboardCharts
            projectNetData={projectNetData}
            costCategoryData={costCategoryData}
            trendData={trendData}
          />

          <Card className="mt-6 overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <SortableTh label="날짜" sortKey="date" current={sort} dir={dir} />
                  <SortableTh label="프로젝트" sortKey="project" current={sort} dir={dir} />
                  <th className="px-4 py-3 font-medium">카테고리</th>
                  <th className="px-4 py-3 font-medium">항목명</th>
                  <SortableTh label="금액" sortKey="amount" current={sort} dir={dir} align="right" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3">{r.project}</td>
                    <td className="px-4 py-3">{r.category}</td>
                    <td className="px-4 py-3 text-muted">{r.item}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${r.amount >= 0 ? "text-good" : "text-bad"}`}>
                      {fmt(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <Card className="p-4">
      <p className="mb-1 text-[11px] font-semibold text-muted">{label}</p>
      <p className={`text-lg font-bold ${tone === "pos" ? "text-good" : tone === "neg" ? "text-bad" : ""}`}>
        {value}
      </p>
    </Card>
  );
}

function SortableTh({
  label,
  sortKey,
  current,
  dir,
  align,
}: {
  label: string;
  sortKey: string;
  current: string;
  dir: string;
  align?: "right";
}) {
  const nextDir = current === sortKey && dir === "desc" ? "asc" : "desc";
  return (
    <th className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : ""}`}>
      <Link
        href={{ query: { sort: sortKey, dir: nextDir } }}
        className="hover:text-foreground"
      >
        {label} {current === sortKey ? (dir === "asc" ? "↑" : "↓") : ""}
      </Link>
    </th>
  );
}
