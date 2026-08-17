"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  requestTransactionDeletion,
} from "@/lib/actions/transactions";
import { DeleteAction } from "@/components/DeleteAction";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card, FormError } from "@/components/ui/Card";
import type { Database } from "@/lib/supabase/types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

const fmtAmount = (n: number) => n.toLocaleString("ko-KR");

export function TransactionsSection({
  projectId,
  transactions,
  canCreate,
  canUpdate,
  canDeleteDirectly,
  pendingDeletionTxIds,
}: {
  projectId: string;
  transactions: Transaction[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeleteDirectly: boolean;
  pendingDeletionTxIds: Set<string>;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">거래내역</h2>
        {canCreate && !adding && (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            + 거래 입력
          </Button>
        )}
      </div>

      {adding && (
        <Card className="mb-3">
          <NewTransactionForm
            projectId={projectId}
            onDone={() => setAdding(false)}
          />
        </Card>
      )}

      {transactions.length === 0 ? (
        <Card className="text-center text-sm text-muted">거래내역이 없습니다.</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">날짜</th>
                <th className="px-4 py-3 font-medium">구분</th>
                <th className="px-4 py-3 font-medium">카테고리</th>
                <th className="px-4 py-3 font-medium">항목명</th>
                <th className="px-4 py-3 text-right font-medium">금액</th>
                <th className="px-4 py-3 font-medium">출처</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) =>
                editingId === tx.id ? (
                  <tr key={tx.id} className="border-b border-border last:border-0">
                    <td colSpan={7} className="px-4 py-3">
                      <EditTransactionForm
                        tx={tx}
                        projectId={projectId}
                        onDone={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-background">
                    <td className="px-4 py-3">{tx.tx_date}</td>
                    <td className="px-4 py-3">
                      <span className={tx.kind === "수익" ? "text-good" : "text-bad"}>{tx.kind}</span>
                    </td>
                    <td className="px-4 py-3">{tx.category}</td>
                    <td className="px-4 py-3 text-muted">{tx.item_name ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtAmount(tx.amount)} {tx.currency}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {tx.source === "excel_upload" ? "엑셀 업로드" : "직접 입력"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {pendingDeletionTxIds.has(tx.id) ? (
                        <span className="text-xs text-bad">삭제 승인 대기중</span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          {canUpdate && (
                            <button
                              type="button"
                              className="text-xs text-accent hover:underline"
                              onClick={() => setEditingId(tx.id)}
                            >
                              수정
                            </button>
                          )}
                          <DeleteAction
                            mode={canDeleteDirectly ? "direct" : "request"}
                            onConfirm={
                              canDeleteDirectly
                                ? deleteTransaction.bind(null, tx.id, projectId)
                                : undefined
                            }
                            onRequest={
                              !canDeleteDirectly
                                ? requestTransactionDeletion.bind(null, tx.id, projectId)
                                : undefined
                            }
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function TransactionFields({ tx }: { tx?: Transaction }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div>
        <Label htmlFor="tx_date">날짜 *</Label>
        <Input id="tx_date" name="tx_date" type="date" required defaultValue={tx?.tx_date} />
      </div>
      <div>
        <Label htmlFor="kind">구분 *</Label>
        <select
          id="kind"
          name="kind"
          required
          defaultValue={tx?.kind ?? "비용"}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="수익">수익</option>
          <option value="비용">비용</option>
        </select>
      </div>
      <div>
        <Label htmlFor="category">카테고리 *</Label>
        <Input id="category" name="category" required defaultValue={tx?.category} placeholder="예: 매출, 인건비·외주비" />
      </div>
      <div>
        <Label htmlFor="item_name">항목명</Label>
        <Input id="item_name" name="item_name" defaultValue={tx?.item_name ?? ""} />
      </div>
      <div>
        <Label htmlFor="amount">금액 *</Label>
        <Input id="amount" name="amount" type="number" min={1} step="1" required defaultValue={tx?.amount} />
      </div>
      <div>
        <Label htmlFor="currency">통화</Label>
        <Input id="currency" name="currency" defaultValue={tx?.currency ?? "KRW"} />
      </div>
      <div className="col-span-2 sm:col-span-3">
        <Label htmlFor="note">비고</Label>
        <Input id="note" name="note" defaultValue={tx?.note ?? ""} />
      </div>
    </div>
  );
}

function NewTransactionForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const boundAction = createTransaction.bind(null, projectId);
  const [state, formAction, pending] = useActionState(boundAction, null);

  useEffect(() => {
    if (state?.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <TransactionFields />
      <FormError message={state?.ok === false ? state.error : null} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : "저장"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          취소
        </Button>
      </div>
    </form>
  );
}

function EditTransactionForm({
  tx,
  projectId,
  onDone,
}: {
  tx: Transaction;
  projectId: string;
  onDone: () => void;
}) {
  const boundAction = updateTransaction.bind(null, tx.id, projectId);
  const [state, formAction, pending] = useActionState(boundAction, null);

  useEffect(() => {
    if (state?.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <TransactionFields tx={tx} />
      <FormError message={state?.ok === false ? state.error : null} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : "저장"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          취소
        </Button>
      </div>
    </form>
  );
}
