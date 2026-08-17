import { createClient } from "@/lib/supabase/server";
import { finalizePendingSignup } from "@/lib/actions/auth";
import { NextResponse } from "next/server";

// Supabase 이메일 인증 링크가 최종적으로 도착하는 곳.
// code를 세션으로 교환한 뒤, 대기 중이던 회사 생성(신규 가입 경로)을 마무리한다.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Supabase가 자체 검증(/auth/v1/verify) 단계에서 이미 실패시킨 경우
  // (토큰 만료/이미 사용됨 등) — code 교환 전에 여기로 에러가 붙어서 온다.
  const supabaseErrorCode = searchParams.get("error_code");
  if (supabaseErrorCode) {
    const description = searchParams.get("error_description") ?? supabaseErrorCode;
    console.error("[auth/callback] Supabase verify 실패:", supabaseErrorCode, description);
    const message =
      supabaseErrorCode === "otp_expired"
        ? "인증 링크가 만료되었거나 이미 사용되었습니다. 다시 가입해주세요."
        : decodeURIComponent(description).replace(/\+/g, " ");
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await finalizePendingSignup();
      return NextResponse.redirect(`${origin}/dashboard`);
    }
    console.error("[auth/callback] exchangeCodeForSession 실패:", error.message);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  console.error("[auth/callback] code/error 파라미터가 모두 없는 요청:", request.url);
  return NextResponse.redirect(`${origin}/login?error=인증에 실패했습니다`);
}
