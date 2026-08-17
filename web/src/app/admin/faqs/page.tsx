import { createClient } from "@/lib/supabase/server";
import { FaqsClient } from "./FaqsClient";

export default async function AdminFaqsPage() {
  const supabase = await createClient();
  const { data: faqs } = await supabase
    .from("faqs")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">FAQ 관리</h1>
      <FaqsClient faqs={faqs ?? []} />
    </div>
  );
}
