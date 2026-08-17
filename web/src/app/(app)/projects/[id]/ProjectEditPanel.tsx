"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { ProjectForm } from "@/components/ProjectForm";
import type { ActionResult } from "@/lib/actions/auth";
import type { Database } from "@/lib/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

const statusStyle: Record<string, string> = {
  진행중: "bg-accent/10 text-accent-deep",
  진행완료: "bg-good/10 text-good",
  진행예정: "bg-muted/10 text-muted",
};

export function ProjectEditPanel({
  project,
  canEdit,
  updateAction,
}: {
  project: Project;
  canEdit: boolean;
  updateAction: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <Card>
        <ProjectForm
          action={updateAction}
          defaults={project}
          submitLabel="저장"
          onSuccess={() => setEditing(false)}
        />
        <button
          type="button"
          className="mt-2 text-xs text-muted underline"
          onClick={() => setEditing(false)}
        >
          취소
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Field label="상태">
            <span className={`rounded-full px-2 py-0.5 text-xs ${statusStyle[project.status]}`}>
              {project.status}
            </span>
          </Field>
          <Field label="분야">{project.field ?? "—"}</Field>
          <Field label="기간">
            {project.start_date ?? "—"} ~ {project.end_date ?? "—"}
          </Field>
          <Field label="담당자">{project.owner_name ?? "—"}</Field>
          {project.note && (
            <div className="col-span-2">
              <Field label="비고">{project.note}</Field>
            </div>
          )}
        </dl>
        {canEdit && (
          <button
            type="button"
            className="text-xs font-semibold text-accent hover:underline"
            onClick={() => setEditing(true)}
          >
            수정
          </button>
        )}
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
