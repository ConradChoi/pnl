import { Card } from "@/components/ui/Card";
import { ProjectForm } from "@/components/ProjectForm";
import { createProject } from "@/lib/actions/projects";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-lg font-bold">프로젝트 등록</h1>
      <Card>
        <ProjectForm action={createProject} submitLabel="등록" />
      </Card>
    </div>
  );
}
