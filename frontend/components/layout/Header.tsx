"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Coins,
  FileSearch,
  GitCompareArrows,
  Landmark,
  LayoutDashboard,
  LogOut,
  PenTool,
  Plus,
  Scale,
  ShieldCheck,
  Ticket,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { logout as authLogout, me } from "@/lib/api/auth";
import { buildLoginRedirectHref } from "@/lib/auth/redirect";
import { getToken, onAuthChange } from "@/lib/auth/token";
import { tools } from "@/lib/config/tools";
import { getEnabledToolSlugs } from "@/lib/features/toolFeatureGate";
import {
  notifyCreditsChanged,
  onCreditsChanged,
} from "@/lib/billing/creditBus";
import { RedeemVoucherModal } from "@/components/billing/RedeemVoucherModal";

const TOOL_ICONS: Record<string, LucideIcon> = {
  FileSearch,
  Scale,
  GitCompareArrows,
  Landmark,
  PenTool,
};

const ADMIN_EMAIL = "1@mail.com";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [displayBalance, setDisplayBalance] = useState<number | null>(null);
  const [balanceFlash, setBalanceFlash] = useState<"up" | "down" | null>(null);
  const balanceAnimRef = useRef<number | null>(null);
  const balanceFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const toolsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [enabledToolSlugs, setEnabledToolSlugs] = useState<Set<string> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    setEnabledToolSlugs(new Set());
    getEnabledToolSlugs(tools.map((tool) => tool.slug))
      .then((enabled) => {
        if (!cancelled) setEnabledToolSlugs(enabled);
      })
      .catch(() => {
        if (!cancelled) setEnabledToolSlugs(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  const visibleTools = enabledToolSlugs
    ? tools.filter((tool) => enabledToolSlugs.has(tool.slug))
    : tools;

  function openToolsMenu() {
    if (toolsCloseTimerRef.current) {
      clearTimeout(toolsCloseTimerRef.current);
      toolsCloseTimerRef.current = null;
    }
    setToolsMenuOpen(true);
  }

  function scheduleCloseToolsMenu() {
    if (toolsCloseTimerRef.current) clearTimeout(toolsCloseTimerRef.current);
    toolsCloseTimerRef.current = setTimeout(() => setToolsMenuOpen(false), 120);
  }

  useEffect(() => {
    let cancelled = false;

    function clearAuthState() {
      setLoggedIn(false);
      setUserEmail("");
      setCreditBalance(null);
      setAvatarMenuOpen(false);
      setIsAdmin(false);
    }

    function applyAuthenticatedUser(u: Awaited<ReturnType<typeof me>>) {
      const email = u.email.trim();
      setLoggedIn(true);
      setUserEmail(email);
      setCreditBalance(u.credit_balance);
      notifyCreditsChanged(u.credit_balance);
      setIsAdmin(email.toLowerCase() === ADMIN_EMAIL);
    }

    async function refreshAuthState() {
      const token = getToken();
      if (!token) {
        clearAuthState();
        setAuthReady(true);
        return;
      }

      try {
        const u = await me();
        if (cancelled) return;
        applyAuthenticatedUser(u);
      } catch {
        if (cancelled) return;
        authLogout();
        clearAuthState();
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }

    void refreshAuthState();
    return onAuthChange(() => {
      void refreshAuthState();
    });
  }, []);

  useEffect(() => {
    setAvatarMenuOpen(false);
    setToolsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    return onCreditsChanged((next) => setCreditBalance(next));
  }, []);

  useEffect(() => {
    if (creditBalance == null) {
      setDisplayBalance(null);
      return;
    }
    setDisplayBalance((prev) => {
      if (prev == null) return creditBalance;
      if (prev === creditBalance) return prev;

      if (balanceAnimRef.current != null) {
        cancelAnimationFrame(balanceAnimRef.current);
      }
      const start = prev;
      const target = creditBalance;
      const startedAt = performance.now();
      const duration = Math.min(
        1200,
        320 + Math.min(900, Math.abs(target - start) * 1.2),
      );

      const tick = (now: number) => {
        const t = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const value = start + (target - start) * eased;
        setDisplayBalance(t >= 1 ? target : Math.round(value));
        if (t < 1) {
          balanceAnimRef.current = requestAnimationFrame(tick);
        } else {
          balanceAnimRef.current = null;
        }
      };
      balanceAnimRef.current = requestAnimationFrame(tick);

      setBalanceFlash(target < start ? "down" : "up");
      if (balanceFlashTimerRef.current)
        clearTimeout(balanceFlashTimerRef.current);
      balanceFlashTimerRef.current = setTimeout(
        () => setBalanceFlash(null),
        900,
      );

      return prev;
    });
  }, [creditBalance]);

  useEffect(() => {
    return () => {
      if (balanceAnimRef.current != null)
        cancelAnimationFrame(balanceAnimRef.current);
      if (balanceFlashTimerRef.current)
        clearTimeout(balanceFlashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!avatarMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!avatarMenuRef.current?.contains(event.target as Node)) {
        setAvatarMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAvatarMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [avatarMenuOpen]);

  function handleLogout() {
    authLogout();
    setLoggedIn(false);
    setUserEmail("");
    setCreditBalance(null);
    setAvatarMenuOpen(false);
    router.push("/");
  }

  function handleHardNavigate(href: string) {
    window.location.href = href;
  }

  function handleMenuLinkMouseDown(
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    setToolsMenuOpen(false);
    handleHardNavigate(href);
  }

  function navClass(href: string): string {
    const isActive =
      href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(`${href}/`);
    return `inline-flex items-center rounded-full px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-stone-900 text-stone-50 shadow-[0_10px_30px_rgba(28,25,23,0.16)]"
        : "text-stone-600 hover:bg-white/70 hover:text-stone-900"
    }`;
  }

  const avatarInitial = (userEmail || "S").slice(0, 1).toUpperCase();
  const accountName = userEmail ? userEmail.split("@")[0] : "SmartAnalyzer";
  const balanceLabel =
    displayBalance == null ? "—" : displayBalance.toLocaleString("ru-RU");
  const isHomeLanding = pathname === "/" && !loggedIn;
  const isPricingLanding = pathname === "/pricing" && !loggedIn;
  const isToolsLanding = pathname === "/tools" && !loggedIn;
  const isFocusedMarketing =
    isHomeLanding || isPricingLanding || isToolsLanding;

  const avatarHue = (() => {
    const seed = userEmail || "smartanalyzer";
    let h = 0;
    for (let i = 0; i < seed.length; i += 1)
      h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return h % 360;
  })();
  const avatarBg = `radial-gradient(circle at 28% 22%, hsl(${avatarHue} 92% 78%) 0%, hsl(${(avatarHue + 28) % 360} 78% 52%) 38%, hsl(${(avatarHue + 220) % 360} 70% 28%) 78%)`;
  const avatarConic = `conic-gradient(from 140deg, hsl(${avatarHue} 90% 70% / 0.9), hsl(${(avatarHue + 60) % 360} 90% 65% / 0.9), hsl(${(avatarHue + 200) % 360} 90% 60% / 0.9), hsl(${avatarHue} 90% 70% / 0.9))`;

  return (
    <header className="sticky top-0 z-[1000] isolate pointer-events-auto border-b border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(250,248,243,0.9))] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-stretch justify-between gap-4 rounded-[28px] border border-stone-200/80 bg-white/80 px-4 py-3 shadow-[0_12px_40px_rgba(28,25,23,0.08)] backdrop-blur sm:flex-row sm:items-center sm:px-5">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.32),rgba(255,255,255,0.96)_62%)] text-sm font-semibold text-emerald-700 shadow-[0_10px_30px_rgba(16,185,129,0.12)]">
              SA
            </span>
            <span className="flex flex-col">
              <span className="text-xl font-semibold tracking-[-0.04em] text-stone-900 transition group-hover:text-stone-700">
                SmartAnalyzer
              </span>
              <span className="text-[11px] uppercase tracking-[0.24em] text-stone-400">
                Document intelligence
              </span>
            </span>
          </Link>
          <nav className="flex max-w-full items-center gap-2 overflow-x-auto rounded-full border border-stone-200/80 bg-stone-100/80 px-2 py-2 sm:max-w-none sm:overflow-visible">
            {!isFocusedMarketing && (
              <div
                className="relative"
                onMouseEnter={openToolsMenu}
                onMouseLeave={scheduleCloseToolsMenu}
              >
                <Link
                  href="/tools"
                  className={`${navClass("/tools")} gap-1`}
                  aria-haspopup="true"
                  aria-expanded={toolsMenuOpen}
                >
                  Инструменты
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      toolsMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </Link>

                {toolsMenuOpen && (
                  <div
                    role="menu"
                    onMouseEnter={openToolsMenu}
                    onMouseLeave={scheduleCloseToolsMenu}
                    className="absolute right-0 top-[calc(100%+12px)] z-[1200] w-[min(720px,calc(100vw-32px))] origin-top-right animate-[avatar-menu-in_180ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden rounded-[22px] border border-stone-200 bg-white p-3 shadow-[0_24px_64px_-12px_rgba(15,23,42,0.28),0_8px_20px_-8px_rgba(15,23,42,0.16)]"
                  >
                    <span className="pointer-events-none absolute -top-1.5 right-6 h-3 w-3 rotate-45 border-l border-t border-stone-200 bg-white" />

                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {visibleTools.map((tool) => {
                        const Icon = TOOL_ICONS[tool.icon] ?? FileSearch;
                        return (
                          <Link
                            key={tool.slug}
                            href={`/tools/${tool.slug}`}
                            onMouseDown={(event) =>
                              handleMenuLinkMouseDown(
                                event,
                                `/tools/${tool.slug}`,
                              )
                            }
                            role="menuitem"
                            className="group/tool flex items-start gap-3 rounded-xl border border-transparent p-2.5 transition hover:border-emerald-100 hover:bg-emerald-50/40"
                          >
                            <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-200/70 bg-[radial-gradient(circle_at_top,rgba(110,231,183,0.32),rgba(255,255,255,0.96)_62%)] text-emerald-700 transition group-hover/tool:border-emerald-300 group-hover/tool:shadow-[0_6px_18px_rgba(16,185,129,0.18)]">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-semibold tracking-[-0.01em] text-stone-950">
                                {tool.title}
                              </span>
                              <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug text-stone-500">
                                {tool.description}
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>

                    <Link
                      href="/tools"
                      onMouseDown={(event) =>
                        handleMenuLinkMouseDown(event, "/tools")
                      }
                      className="mt-2 flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[12.5px] font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-100"
                    >
                      Все инструменты
                      <span className="text-stone-400">→</span>
                    </Link>
                  </div>
                )}
              </div>
            )}
            {!authReady ? (
              <div aria-hidden="true" className="flex items-center gap-2 px-1">
                <span className="h-9 w-28 animate-pulse rounded-full bg-white/70 shadow-sm" />
                <span className="h-9 w-11 animate-pulse rounded-2xl bg-white/70 shadow-sm" />
              </div>
            ) : loggedIn ? (
              <>
                <div
                  className={`group/balance flex items-center gap-1 rounded-full border p-1 pl-3 transition duration-500 ${
                    balanceFlash === "down"
                      ? "border-rose-300 bg-gradient-to-r from-rose-50 via-white to-rose-50/60 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_6px_20px_rgba(244,63,94,0.18)]"
                      : balanceFlash === "up"
                        ? "border-emerald-300 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/60 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_6px_20px_rgba(16,185,129,0.22)]"
                        : "border-emerald-200/70 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/60 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_4px_14px_rgba(16,185,129,0.10)] hover:border-emerald-300 hover:shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_6px_20px_rgba(16,185,129,0.18)]"
                  }`}
                >
                  <span
                    title="Текущий баланс кредитов"
                    className={`flex items-center gap-1.5 text-[13px] font-semibold tabular-nums transition-colors duration-500 ${
                      balanceFlash === "down"
                        ? "text-rose-700"
                        : "text-emerald-800"
                    }`}
                  >
                    <Coins
                      className={`h-4 w-4 transition-colors duration-500 ${
                        balanceFlash === "down"
                          ? "text-rose-600"
                          : "text-emerald-600"
                      }`}
                    />
                    <span className="leading-none">{balanceLabel}</span>
                    <span
                      className={`text-[11px] font-medium transition-colors duration-500 ${
                        balanceFlash === "down"
                          ? "text-rose-600/80"
                          : "text-emerald-600/80"
                      }`}
                    >
                      кр.
                    </span>
                  </span>
                  <Link
                    href="/pricing"
                    title="Пополнить баланс"
                    className="ml-1 inline-flex h-7 items-center gap-1 rounded-full bg-stone-900 px-2.5 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(15,23,42,0.18)] transition hover:bg-emerald-600 hover:shadow-[0_6px_16px_rgba(16,185,129,0.32)]"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                    Пополнить
                  </Link>
                </div>
                <div className="relative" ref={avatarMenuRef}>
                  <button
                    onClick={() => setAvatarMenuOpen((open) => !open)}
                    type="button"
                    title="Аккаунт"
                    aria-label="Открыть меню аккаунта"
                    aria-expanded={avatarMenuOpen}
                    className="group relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-stone-300 bg-[radial-gradient(circle_at_32%_22%,rgba(250,250,249,0.95),rgba(16,185,129,0.22)_30%,rgba(15,23,42,0.92)_72%)] text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_26px_rgba(28,25,23,0.16)] transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_34px_rgba(16,185,129,0.2)] focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
                  >
                    <span className="absolute inset-x-2 top-2 h-3 rounded-full bg-white/18 blur-[1px]" />
                    <span className="absolute -bottom-2 left-1/2 h-7 w-8 -translate-x-1/2 rounded-t-full bg-emerald-950/70 ring-1 ring-white/10" />
                    <span className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-stone-950/70 text-[11px] ring-1 ring-white/20 transition group-hover:bg-emerald-950/80">
                      {avatarInitial}
                    </span>
                  </button>

                  {avatarMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-[calc(100%+10px)] z-[1200] w-[min(320px,calc(100vw-32px))] origin-top-right animate-[avatar-menu-in_180ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden rounded-[22px] border border-stone-200 bg-white p-2 text-stone-900 shadow-[0_24px_64px_-12px_rgba(15,23,42,0.28),0_8px_20px_-8px_rgba(15,23,42,0.16)]"
                    >
                      <span className="pointer-events-none absolute -top-1.5 right-5 h-3 w-3 rotate-45 border-l border-t border-stone-200 bg-white" />

                      <div className="relative overflow-hidden rounded-[18px] border border-emerald-100 bg-[linear-gradient(135deg,#f8fafc_0%,#ecfdf5_55%,#f8fafc_100%)] p-3">
                        <span className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-emerald-200/40 blur-2xl" />
                        <div className="relative flex items-center gap-3">
                          <div
                            className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl text-lg font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_22px_rgba(15,23,42,0.22)]"
                            style={{ backgroundImage: avatarBg }}
                          >
                            <span
                              className="pointer-events-none absolute -inset-1 rounded-[20px] opacity-70 blur-md animate-[avatar-spin_8s_linear_infinite]"
                              style={{ backgroundImage: avatarConic }}
                              aria-hidden
                            />
                            <span className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_70%_85%,rgba(255,255,255,0.18),transparent_55%)]" />
                            <span className="pointer-events-none absolute inset-x-2 top-1.5 h-2.5 rounded-full bg-white/30 blur-[2px]" />
                            <span className="pointer-events-none absolute right-1.5 top-1.5 h-1 w-1 rounded-full bg-white/85 shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
                            <span className="relative z-10 select-none drop-shadow-[0_1px_2px_rgba(15,23,42,0.55)]">
                              {avatarInitial}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-stone-950">
                              {accountName}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-stone-500">
                              {userEmail}
                            </p>
                            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-white/70 px-2 py-0.5 text-[12px] font-semibold text-emerald-700 shadow-sm">
                              <Coins className="h-3.5 w-3.5" />
                              {balanceLabel}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-1.5 flex flex-col gap-0.5">
                        <Link
                          href="/profile"
                          role="menuitem"
                          className="group/item flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] font-medium text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-950 focus:bg-stone-100 focus:outline-none"
                        >
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-sky-100 transition group-hover/item:bg-sky-100 group-hover/item:scale-105">
                            <UserRound className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            Профиль
                          </span>
                        </Link>
                        <Link
                          href="/dashboard"
                          role="menuitem"
                          className="group/item flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] font-medium text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-950 focus:bg-stone-100 focus:outline-none"
                        >
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600 ring-1 ring-stone-200/80 transition group-hover/item:bg-stone-200 group-hover/item:scale-105">
                            <LayoutDashboard className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            Кабинет
                          </span>
                        </Link>
                        {isAdmin && (
                          <Link
                            href="/admin"
                            role="menuitem"
                            className="group/item flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] font-medium text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-950 focus:bg-stone-100 focus:outline-none"
                          >
                            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 transition group-hover/item:bg-emerald-100 group-hover/item:scale-105">
                              <ShieldCheck className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              Админ-панель
                            </span>
                          </Link>
                        )}

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setAvatarMenuOpen(false);
                            setRedeemOpen(true);
                          }}
                          className="group/item flex items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-medium text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-950 focus:bg-stone-100 focus:outline-none"
                        >
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 transition group-hover/item:bg-emerald-100 group-hover/item:scale-105">
                            <Ticket className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            Активировать ваучер
                          </span>
                        </button>

                        <div className="my-1 h-px bg-stone-200/80" />

                        <button
                          type="button"
                          onClick={handleLogout}
                          role="menuitem"
                          className="group/item flex items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-medium text-rose-700 transition-colors hover:bg-rose-50 hover:text-rose-800 focus:bg-rose-50 focus:outline-none"
                        >
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-rose-100 transition group-hover/item:bg-rose-100 group-hover/item:scale-105">
                            <LogOut className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate">Выйти</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {!isFocusedMarketing && (
                  <Link href="/pricing" className={navClass("/pricing")}>
                    Кредиты
                  </Link>
                )}
                <Link
                  href={buildLoginRedirectHref(pathname)}
                  className="inline-flex items-center rounded-full px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-white/70 hover:text-stone-900"
                >
                  Войти
                </Link>
                <Button
                  href={
                    isHomeLanding
                      ? "/tools/document-analyzer"
                      : isPricingLanding
                        ? "#credit-packages"
                        : isToolsLanding
                          ? "/tools/document-analyzer"
                          : "/register"
                  }
                  variant="primary"
                  className="whitespace-nowrap rounded-full bg-stone-900 px-4 hover:bg-stone-800 focus:ring-stone-500 sm:px-5"
                >
                  {isHomeLanding
                    ? "Проверить бесплатно"
                    : isPricingLanding
                      ? "Купить кредиты"
                      : isToolsLanding
                        ? "Проверить договор"
                        : "Попробовать бесплатно"}
                </Button>
              </>
            )}
          </nav>
        </div>
      </div>
      <RedeemVoucherModal
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
      />
    </header>
  );
}
