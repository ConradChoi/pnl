import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

// PRD 7절 API-first 원칙: 이 클라이언트는 Server Component/Server Action에서만 쓴다.
// 브라우저 쪽은 client.ts의 createClient()를 쓰고, 두 경로 모두 동일한 RLS 규칙을 통과한다
// (권한 판단은 DB가 하므로 어느 경로로 접근해도 결과가 같다 — BACKEND_DESIGN.md 2절).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서 호출된 경우 — 미들웨어가 세션 갱신을 대신 처리하므로 무시 가능
          }
        },
      },
    }
  );
}
