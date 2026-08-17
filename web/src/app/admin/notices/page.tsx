import { createClient } from "@/lib/supabase/server";
import { NoticesClient } from "./NoticesClient";

export default async function AdminNoticesPage() {
  const supabase = await createClient();
  const { data: notices } = await supabase.from("notices").select("*").order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">공지사항 관리</h1>
      <NoticesClient notices={notices ?? []} />
    </div>
  );
}
