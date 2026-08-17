import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("platform_settings").select("*").eq("id", true).single();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-lg font-bold">운영 설정</h1>
      <p className="mb-4 text-xs text-muted">
        여기 값은 배포 없이 즉시 개인정보처리방침·이용약관 공개 페이지에 반영됩니다.
      </p>
      <SettingsForm settings={settings} />
    </div>
  );
}
