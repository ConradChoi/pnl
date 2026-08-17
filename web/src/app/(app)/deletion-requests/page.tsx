import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/data/membership";
import { Card } from "@/components/ui/Card";
import { DecisionButtons } from "./DecisionButtons";

export default async function DeletionRequestsPage() {
  const membership = await requireMembership();
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("deletion_requests")
    .select(
      `id, reason, created_at, requested_by,
       project:projects(id, name),
       transaction:transactions(id, category, item_name, amount, tx_date)`
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const requesterIds = [...new Set((requests ?? []).map((r) => r.requested_by))];
  const { data: requesterProfiles } = requesterIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", requesterIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const nameById = new Map((requesterProfiles ?? []).map((p) => [p.id, p.display_name]));

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">삭제 승인함</h1>

      {!requests || requests.length === 0 ? (
        <Card className="text-center text-sm text-muted">대기 중인 삭제 요청이 없습니다.</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((r) => {
            const project = Array.isArray(r.project) ? r.project[0] : r.project;
            const tx = Array.isArray(r.transaction) ? r.transaction[0] : r.transaction;
            const target = project
              ? `프로젝트 · ${project.name}`
              : `거래내역 · ${tx?.tx_date} · ${tx?.category} ${tx?.item_name ?? ""} (${tx?.amount.toLocaleString("ko-KR")}원)`;

            return (
              <Card key={r.id}>
                <div className="mb-2 flex items-start justify-between text-sm">
                  <div>
                    <p className="font-semibold">{target}</p>
                    <p className="text-xs text-muted">
                      요청자: {nameById.get(r.requested_by) ?? "알 수 없음"} ·{" "}
                      {new Date(r.created_at).toLocaleString("ko-KR")}
                    </p>
                  </div>
                </div>
                <p className="mb-3 rounded-lg bg-background p-3 text-sm">{r.reason}</p>
                <DecisionButtons
                  requestId={r.id}
                  isSelf={r.requested_by === membership.userId}
                />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
