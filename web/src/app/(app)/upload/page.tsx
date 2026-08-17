"use client";

import { useRef, useState, useTransition } from "react";
import { parseWorkbookFile } from "@/lib/excel/parse";
import {
  previewExcelUpload,
  commitExcelUpload,
  type PreviewedRow,
  type CommitResult,
} from "@/lib/actions/excelUpload";
import { Button } from "@/components/ui/Button";
import { Card, FormError } from "@/components/ui/Card";

type Stage =
  | { step: "idle" }
  | { step: "preview"; fileName: string; totalParsedRows: number; rows: PreviewedRow[]; newProjectNames: string[] }
  | { step: "result"; result: Extract<CommitResult, { ok: true }> };

export default function UploadPage() {
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError(null);
    startTransition(async () => {
      const parsed = await parseWorkbookFile(file);
      if (parsed.error) {
        setError(parsed.error);
        return;
      }
      const preview = await previewExcelUpload(parsed.rows);
      if (!preview.ok) {
        setError(preview.error);
        return;
      }
      // 신규 행은 기본 체크, 중복 의심 행은 기본 체크 해제 (SERVICE_SPEC 4.1)
      const initialChecked: Record<number, boolean> = {};
      preview.rows.forEach((r, i) => (initialChecked[i] = !r.isDuplicateSuspect));
      setChecked(initialChecked);
      setStage({
        step: "preview",
        fileName: file.name,
        totalParsedRows: parsed.rows.length,
        rows: preview.rows,
        newProjectNames: preview.newProjectNames,
      });
    });
  };

  if (stage.step === "result") {
    return <ResultView result={stage.result} onReset={() => setStage({ step: "idle" })} />;
  }

  if (stage.step === "preview") {
    const selectedCount = Object.values(checked).filter(Boolean).length;

    const toggleAll = (value: boolean) => {
      const next: Record<number, boolean> = {};
      stage.rows.forEach((_, i) => (next[i] = value));
      setChecked(next);
    };

    const handleCommit = () => {
      const selectedRows = stage.rows.filter((_, i) => checked[i]);
      startTransition(async () => {
        const result = await commitExcelUpload(stage.fileName, stage.totalParsedRows, selectedRows);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setStage({ step: "result", result });
      });
    };

    return (
      <div>
        <h1 className="mb-4 text-lg font-bold">엑셀 업로드 — 미리보기</h1>

        {stage.newProjectNames.length > 0 && (
          <Card className="mb-3 text-sm">
            <p className="mb-1 font-semibold">신규로 추가될 프로젝트 ({stage.newProjectNames.length}건)</p>
            <p className="text-muted">{stage.newProjectNames.join(", ")}</p>
          </Card>
        )}

        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-muted">
            총 {stage.rows.length}건 중 {selectedCount}건 선택됨
          </p>
          <div className="flex gap-2 text-xs">
            <button className="text-accent hover:underline" onClick={() => toggleAll(true)}>
              전체 선택
            </button>
            <button className="text-muted hover:underline" onClick={() => toggleAll(false)}>
              전체 해제
            </button>
          </div>
        </div>

        <Card className="mb-4 max-h-[28rem] overflow-auto p-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-3 py-2 font-medium">프로젝트</th>
                <th className="px-3 py-2 font-medium">날짜</th>
                <th className="px-3 py-2 font-medium">카테고리</th>
                <th className="px-3 py-2 font-medium">항목명</th>
                <th className="px-3 py-2 text-right font-medium">금액</th>
              </tr>
            </thead>
            <tbody>
              {stage.rows.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!checked[i]}
                      onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {r.isDuplicateSuspect ? (
                      <span className="rounded-full bg-bad/10 px-2 py-0.5 text-xs text-bad">중복 의심</span>
                    ) : r.isNewProject ? (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent-deep">
                        신규 프로젝트
                      </span>
                    ) : (
                      <span className="rounded-full bg-good/10 px-2 py-0.5 text-xs text-good">신규</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.projectName}</td>
                  <td className="px-3 py-2">{r.txDate}</td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className="px-3 py-2 text-muted">{r.itemName || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.amount.toLocaleString("ko-KR")} {r.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <FormError message={error} />

        <div className="flex gap-2">
          <Button disabled={pending || selectedCount === 0} onClick={handleCommit}>
            {pending ? "저장 중..." : `선택한 ${selectedCount}건 저장`}
          </Button>
          <Button variant="secondary" onClick={() => setStage({ step: "idle" })}>
            취소
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">엑셀 업로드</h1>
      <Card
        className={`border-2 border-dashed text-center transition ${dragOver ? "border-accent bg-accent/5" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <div className="py-10">
          <div className="mb-2 text-3xl">📊</div>
          <h2 className="mb-1 text-sm font-bold">P&L 관리대장 엑셀 파일을 업로드하세요</h2>
          <p className="mb-2 text-xs text-muted">
            &apos;거래내역&apos; 시트가 포함된 .xlsx 파일을 드래그하거나 선택해주세요.
          </p>
          <a
            href="/templates/PNL_관리대장_템플릿.xlsx"
            download
            className="mb-6 block text-xs font-semibold text-accent hover:underline"
          >
            ⬇ 기본 양식 다운로드
          </a>
          <Button
            type="button"
            disabled={pending}
            onClick={() => fileInputRef.current?.click()}
          >
            {pending ? "분석 중..." : "파일 선택"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <div className="mt-4">
            <FormError message={error} />
          </div>
        </div>
      </Card>
    </div>
  );
}

function ResultView({
  result,
  onReset,
}: {
  result: Extract<CommitResult, { ok: true }>;
  onReset: () => void;
}) {
  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">업로드 결과</h1>
      <Card>
        <div className="mb-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-good">{result.saved}</p>
            <p className="text-xs text-muted">저장됨</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-muted">{result.excluded}</p>
            <p className="text-xs text-muted">제외됨</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-bad">{result.errors.length}</p>
            <p className="text-xs text-muted">에러</p>
          </div>
        </div>

        {result.errors.length > 0 && (
          <div className="mb-4 rounded-lg bg-bad/5 p-3 text-xs">
            {result.errors.map((e) => (
              <p key={e.row}>
                {e.row}행: {e.reason}
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={onReset}>다른 파일 업로드</Button>
        </div>
      </Card>
    </div>
  );
}
