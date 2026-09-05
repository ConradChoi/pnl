"use client";

import { useState } from "react";
import Link from "next/link";
import { logout } from "@/lib/actions/auth";

type NavItem = { href: string; label: string };

export function SiteHeader({
  brandHref,
  brandLabel,
  brandClassName = "bg-accent",
  title,
  userLabel,
  roleLabel,
  isRepresentative = false,
  navItems,
}: {
  brandHref: string;
  brandLabel: string;
  brandClassName?: string;
  title?: string;
  userLabel: string;
  roleLabel: string;
  isRepresentative?: boolean;
  navItems: NavItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-6">
          <Link href={brandHref} className="flex shrink-0 items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white ${brandClassName}`}
            >
              {brandLabel}
            </span>
            {title && <span className="truncate text-sm font-bold">{title}</span>}
          </Link>
          {/* 데스크톱 내비게이션 — 모바일(md 미만)에서는 숨기고 햄버거 메뉴로 대체 */}
          <nav className="hidden items-center gap-4 text-sm text-muted md:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-3 text-xs text-muted md:flex">
          <span>
            {userLabel} · {roleLabel}
            {isRepresentative && " · 대표"}
          </span>
          <form action={logout}>
            <button type="submit" className="hover:text-foreground hover:underline">
              로그아웃
            </button>
          </form>
        </div>

        {/* 모바일 햄버거 버튼 */}
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border md:hidden"
          aria-label="메뉴 열기"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* 모바일 드롭다운 메뉴 */}
      {open && (
        <div className="border-t border-border bg-surface px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2 py-2 text-muted hover:bg-background hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
            <span>
              {userLabel} · {roleLabel}
              {isRepresentative && " · 대표"}
            </span>
            <form action={logout}>
              <button type="submit" className="font-semibold text-accent hover:underline">
                로그아웃
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
