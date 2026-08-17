import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMembership, getEffectivePermissions, can } from "@/lib/data/membership";
import { deleteProject, requestProjectDeletion, updateProject } from "@/lib/actions/projects";
import { ProjectEditPanel } from "./ProjectEditPanel";
import { TransactionsSection } from "./TransactionsSection";
import { DeleteAction } from "@/components/DeleteAction";
import { Card } from "@/components/ui/Card";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await requireMembership();
  const perms = await getEffectivePermissions(membership.companyId, membership.role);
  const canDeleteDirectly = membership.role !== "member";

  const supabase = await createClient();
  const [{ data: project }, { data: transactions }, { data: pendingDeletion }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("transactions")
      .select("*")
      .eq("project_id", id)
      .order("tx_date", { ascending: false }),
    supabase
      .from("deletion_requests")
      .select("id, status")
      .eq("project_id", id)
      .eq("status", "pending")
      .maybeSingle(),
  ]);

  if (!project) notFound();

  // SERVICE_SPEC 3.2: "이미 대기중인 요청이 있는 항목 → 재요청 버튼 비활성화"를
  // 사후 에러가 아니라 사전에 표시하기 위해, 이 프로젝트의 거래내역 중 대기중 삭제요청 목록을 조회
  const txIds = (transactions ?? []).map((t) => t.id);
  const { data: pendingTxDeletions } = txIds.length
    ? await supabase
        .from("deletion_requests")
        .select("transaction_id")
        .eq("status", "pending")
        .in("transaction_id", txIds)
    : { data: [] as { transaction_id: string | null }[] };
  const pendingTransactionIds = new Set(
    (pendingTxDeletions ?? []).map((d) => d.transaction_id).filter((v): v is string => v !== null)
  );

  const canUpdateProject = can(perms, "project_update");
  const canDeleteProject = can(perms, "project_delete") || membership.role === "owner";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">{project.name}</h1>
          {canDeleteProject && !pendingDeletion && (
            <DeleteAction
              mode={canDeleteDirectly ? "direct" : "request"}
              label="프로젝트 삭제"
              onConfirm={canDeleteDirectly ? deleteProject.bind(null, project.id) : undefined}
              onRequest={
                !canDeleteDirectly ? requestProjectDeletion.bind(null, project.id) : undefined
              }
            />
          )}
        </div>

        {pendingDeletion && (
          <Card className="mb-3 border-bad/30 bg-bad/5 text-xs text-bad">
            이 프로젝트는 삭제 승인 대기 중입니다. 승인되기 전까지 삭제할 수 없습니다.
          </Card>
        )}

        <ProjectEditPanel
          project={project}
          canEdit={canUpdateProject}
          updateAction={updateProject.bind(null, project.id)}
        />
      </div>

      <TransactionsSection
        projectId={project.id}
        transactions={transactions ?? []}
        canCreate={can(perms, "transaction_create")}
        canUpdate={can(perms, "transaction_update")}
        canDeleteDirectly={canDeleteDirectly}
        pendingDeletionTxIds={pendingTransactionIds}
      />
    </div>
  );
}
