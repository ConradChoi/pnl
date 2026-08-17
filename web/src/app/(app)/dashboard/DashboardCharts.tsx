"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  LineChart,
  Line,
  Legend,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/Card";

// 기존 P&L 온라인 대시보드.html 팔레트 계승
const POS = "#2a78d6";
const NEG = "#e34948";
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

export function DashboardCharts({
  projectNetData,
  costCategoryData,
  trendData,
}: {
  projectNetData: { name: string; net: number }[];
  costCategoryData: { name: string; value: number }[];
  trendData: { year: string; 매출: number; 비용: number; 순이익: number }[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Card>
        <h3 className="mb-1 text-sm font-bold">프로젝트별 순이익</h3>
        <p className="mb-3 text-xs text-muted">흑자(파랑) / 적자(빨강)</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={projectNetData} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => v.toLocaleString("ko-KR")} fontSize={11} />
            <YAxis type="category" dataKey="name" width={110} fontSize={11} />
            <Tooltip formatter={(v) => `${Number(v).toLocaleString("ko-KR")}원`} />
            <Bar dataKey="net" radius={[0, 4, 4, 0]}>
              {projectNetData.map((entry, i) => (
                <Cell key={i} fill={entry.net >= 0 ? POS : NEG} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-bold">비용 카테고리 구성</h3>
        <p className="mb-3 text-xs text-muted">전체 비용 대비 비중</p>
        {costCategoryData.length === 0 ? (
          <p className="py-16 text-center text-xs text-muted">비용 데이터가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={costCategoryData} dataKey="value" nameKey="name" outerRadius={90} label={(e) => e.name}>
                {costCategoryData.map((_, i) => (
                  <Cell key={i} fill={SERIES[i % SERIES.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${Number(v).toLocaleString("ko-KR")}원`} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="lg:col-span-2">
        <h3 className="mb-1 text-sm font-bold">연도별 매출·비용·순이익 추이</h3>
        <p className="mb-3 text-xs text-muted">연도 필터와 무관하게 전체 기간 표시 (상태 필터·검색은 반영)</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="year" fontSize={11} />
            <YAxis tickFormatter={(v) => v.toLocaleString("ko-KR")} fontSize={11} />
            <Tooltip formatter={(v) => `${Number(v).toLocaleString("ko-KR")}원`} />
            <Legend />
            <Line type="monotone" dataKey="매출" stroke={SERIES[0]} strokeWidth={2} />
            <Line type="monotone" dataKey="비용" stroke={SERIES[1]} strokeWidth={2} />
            <Line type="monotone" dataKey="순이익" stroke={SERIES[2]} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
