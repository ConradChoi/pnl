import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 엑셀 업로드(SERVICE_SPEC 4절) 프리뷰/커밋 시 파싱된 행 배열을 통째로 보내므로
      // 기본 1MB로는 부족할 수 있어 상향. 실제 행수/파일크기 상한은 별도로 클라이언트에서 체크.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
