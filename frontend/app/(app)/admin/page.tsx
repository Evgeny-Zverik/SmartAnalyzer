"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldCheck, Trash2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { me, logout as authLogout, type User } from "@/lib/api/auth";
import { getToken } from "@/lib/auth/token";
import { buildLoginRedirectHref } from "@/lib/auth/redirect";
import { requestReauth } from "@/lib/auth/session";
import { isUnauthorized } from "@/lib/api/errors";
import { deleteAdminUser, listAdminUsers, type AdminUser } from "@/lib/api/admin";
import { parseApiError } from "@/lib/api/errors";

export const ADMIN_EMAIL = "1@mail.com";

const TOOL_LABELS: Record<string, string> = {
  "document-analyzer": "Анализатор документов",
  "contract-checker": "Проверка договоров",
  "data-extractor": "Сравнение документов",
  "tender-analyzer": "Судебная практика",
  "risk-analyzer": "Анализ рисков",
  "handwriting-recognition": "Распознавание рукописи",
  "legal-style-translator": "Юр. стиль",
  "legal-text-simplifier": "Упрощение юр. текста",
  "spelling-checker": "Правописание",
  "foreign-language-translator": "Перевод",
  "legal-document-design-review": "Оформление документов",
  key_points: "Ключевые пункты",
  dates_deadlines: "Даты и сроки",
};

function toolLabel(slug: string): string {
  return TOOL_LABELS[slug] ?? slug.replace(/[-_]/g, " ");
}

function formatTokens(n: number): string {
  if (!n) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "ни разу";
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return "—";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "только что";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} дн назад`;
  if (days < 30) return `${Math.floor(days / 7)} нед назад`;
  if (days < 365) return `${Math.floor(days / 30)} мес назад`;
  return `${Math.floor(days / 365)} г назад`;
}

type Tab = "users" | "features" | "revenue";

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("users");

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<"recent" | "activity">("recent");
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace(buildLoginRedirectHref("/admin"));
      return;
    }
    me()
      .then((u) => {
        if (u.email.trim().toLowerCase() !== ADMIN_EMAIL) {
          setForbidden(true);
          return;
        }
        setUser(u);
      })
      .catch((err) => {
        if (isUnauthorized(err)) {
          authLogout();
          requestReauth({ reason: "admin" });
          return;
        }
        router.replace(buildLoginRedirectHref("/admin"));
      })
      .finally(() => setChecking(false));
  }, [router]);

  useEffect(() => {
    if (!user || activeTab !== "users" || users !== null) return;
    setUsersLoading(true);
    listAdminUsers()
      .then((res) => setUsers(res.items))
      .catch((err) => {
        if (isUnauthorized(err)) {
          authLogout();
          requestReauth({ reason: "admin_users" });
          return;
        }
        toast.error("Не удалось загрузить пользователей");
        setUsers([]);
      })
      .finally(() => setUsersLoading(false));
  }, [user, activeTab, users]);

  if (checking) {
    return (
      <main className="flex min-h-[calc(100vh-104px)] items-center justify-center bg-gray-50 p-8">
        <p className="text-gray-500">Загрузка…</p>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="flex min-h-[calc(100vh-104px)] items-center justify-center bg-[linear-gradient(170deg,#f7f8f7,#f3f4f6)] p-8">
        <div className="max-w-md rounded-3xl border border-rose-200 bg-white/90 p-8 text-center shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
          <h1 className="text-2xl font-semibold text-zinc-900">Доступ запрещён</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Эта страница доступна только администратору.
          </p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const allUsers = users ?? [];
  const totalRuns = (u: AdminUser) => u.tools.reduce((s, t) => s + t.count, 0);
  const maxRuns = Math.max(1, ...allUsers.map(totalRuns));
  const filteredUsers = allUsers
    .filter((u) =>
      search.trim() === ""
        ? true
        : u.email.toLowerCase().includes(search.trim().toLowerCase())
    )
    .sort((a, b) => {
      if (sortKey === "activity") return totalRuns(b) - totalRuns(a);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  const activeCount = allUsers.filter((u) => u.tools.length > 0).length;
  const inactiveCount = allUsers.length - activeCount;

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAdminUser(deleteTarget.id);
      setUsers((prev) => (prev ? prev.filter((u) => u.id !== deleteTarget.id) : prev));
      toast.success(`Пользователь ${deleteTarget.email} удалён`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(parseApiError(err).message || "Не удалось удалить пользователя");
    } finally {
      setDeleting(false);
    }
  }

  const tabs: { key: Tab; label: string; disabled?: boolean }[] = [
    { key: "users", label: "Пользователи" },
    { key: "features", label: "Фича-модули", disabled: true },
    { key: "revenue", label: "Доходы", disabled: true },
  ];

  return (
    <main className="min-h-[calc(100vh-104px)] bg-[linear-gradient(170deg,#f7f8f7,#f3f4f6_45%,#eef2ff)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[30px] border border-zinc-200/90 bg-white/85 px-6 py-6 shadow-[0_20px_70px_rgba(15,23,42,0.1)] backdrop-blur">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Админ-панель
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-zinc-900 sm:text-4xl">
            Панель администратора
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Вы вошли как <span className="font-semibold text-zinc-900">{user.email}</span>.
          </p>
        </section>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white/90 p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                disabled={tab.disabled}
                onClick={() => !tab.disabled && setActiveTab(tab.key)}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  activeTab === tab.key
                    ? "bg-zinc-900 text-white shadow-[0_10px_30px_rgba(24,24,27,0.2)]"
                    : tab.disabled
                      ? "cursor-not-allowed text-zinc-400"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {tab.label}
                {tab.disabled && (
                  <span className="ml-2 rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
                    скоро
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "users" && (
          <section className="mt-6 rounded-3xl border border-zinc-200 bg-white/95 shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
            <div className="flex flex-col gap-4 border-b border-zinc-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-100/70 text-emerald-700">
                  <UsersIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Пользователи</h2>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
                      Всего {allUsers.length}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-emerald-200">
                      Активные {activeCount}
                    </span>
                    <span className="rounded-full bg-zinc-50 px-2 py-0.5 font-medium text-zinc-500 ring-1 ring-zinc-200">
                      Без активности {inactiveCount}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex rounded-xl border border-zinc-200 bg-zinc-50 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setSortKey("recent")}
                    className={`rounded-lg px-3 py-1.5 font-medium transition ${
                      sortKey === "recent" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    Новые
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortKey("activity")}
                    className={`rounded-lg px-3 py-1.5 font-medium transition ${
                      sortKey === "activity" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    По активности
                  </button>
                </div>
                <input
                  type="search"
                  placeholder="Поиск по email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 sm:w-64"
                />
              </div>
            </div>

            {usersLoading ? (
              <p className="px-5 py-10 text-center text-sm text-zinc-500">Загрузка…</p>
            ) : filteredUsers.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-zinc-500">
                Пользователи не найдены
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {filteredUsers.map((u) => {
                  const total = totalRuns(u);
                  const isActive = u.tools.length > 0;
                  const isExpanded = expandedUserId === u.id;
                  const visibleTools = isExpanded ? u.tools : u.tools.slice(0, 3);
                  const hiddenCount = u.tools.length - visibleTools.length;
                  const initial = u.email.slice(0, 1).toUpperCase();
                  const activityPct = Math.round((total / maxRuns) * 100);

                  return (
                    <li
                      key={u.id}
                      className={`relative grid grid-cols-1 gap-3 px-5 py-4 transition hover:bg-zinc-50/80 md:grid-cols-[minmax(0,1.4fr)_120px_160px_minmax(0,1.6fr)_48px] md:items-center md:gap-5`}
                    >
                      <span
                        aria-hidden
                        className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${
                          isActive ? "bg-emerald-400" : "bg-zinc-200"
                        }`}
                      />
                      {/* User */}
                      <div className="flex min-w-0 items-center gap-3 pl-2">
                        <div
                          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${
                            isActive
                              ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200"
                          }`}
                          aria-hidden
                        >
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-900" title={u.email}>
                            {u.email}
                          </p>
                          <p className="text-xs text-zinc-500">
                            <span title={`ID ${u.id}`}>#{u.id}</span>
                            <span className="mx-1.5 text-zinc-300">•</span>
                            <span title={`Регистрация: ${new Date(u.created_at).toLocaleString()}`}>
                              рег. {new Date(u.created_at).toLocaleDateString()}
                            </span>
                            <span className="mx-1.5 text-zinc-300">•</span>
                            <span
                              className={u.last_seen_at ? "text-zinc-600" : "text-zinc-400"}
                              title={
                                u.last_seen_at
                                  ? `Последняя активность: ${new Date(u.last_seen_at).toLocaleString()}`
                                  : "Нет активности"
                              }
                            >
                              был(а): {formatRelative(u.last_seen_at)}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Plan */}
                      <div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            u.plan === "pro"
                              ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                              : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200"
                          }`}
                        >
                          {u.plan === "pro" ? "Pro" : "Free"}
                        </span>
                      </div>

                      {/* Activity */}
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-semibold tabular-nums text-zinc-900">
                            {total}
                          </span>
                          <span className="text-[11px] uppercase tracking-wider text-zinc-400">
                            запусков
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isActive ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-zinc-200"
                            }`}
                            style={{ width: `${activityPct}%` }}
                          />
                        </div>
                        <div
                          className="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-500"
                          title={`Входящие: ${u.tokens_in.toLocaleString()} · Исходящие: ${u.tokens_out.toLocaleString()}`}
                        >
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-50 px-1.5 py-0.5 font-medium text-sky-700 ring-1 ring-sky-200">
                            <span className="text-sky-400">↓</span>
                            <span className="tabular-nums">{formatTokens(u.tokens_in)}</span>
                          </span>
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 font-medium text-violet-700 ring-1 ring-violet-200">
                            <span className="text-violet-400">↑</span>
                            <span className="tabular-nums">{formatTokens(u.tokens_out)}</span>
                          </span>
                          <span className="text-zinc-400">токенов</span>
                        </div>
                      </div>

                      {/* Tools */}
                      <div className="min-w-0">
                        {u.tools.length === 0 ? (
                          <span className="text-xs text-zinc-400">Нет активности</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {visibleTools.map((t) => (
                              <span
                                key={t.slug}
                                title={`${t.slug} · запусков: ${t.count}`}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/80 px-2 py-0.5 text-xs font-medium text-emerald-800"
                              >
                                <span className="max-w-[140px] truncate">{toolLabel(t.slug)}</span>
                                <span className="rounded-full bg-white px-1.5 text-[10px] font-semibold tabular-nums text-emerald-700">
                                  {t.count}
                                </span>
                              </span>
                            ))}
                            {u.tools.length > 3 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedUserId(isExpanded ? null : u.id)
                                }
                                className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-xs font-semibold text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-900"
                              >
                                {isExpanded ? "Свернуть" : `+${hiddenCount}`}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Delete */}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(u)}
                          disabled={u.id === user.id}
                          title={
                            u.id === user.id
                              ? "Нельзя удалить самого себя"
                              : "Удалить из БД"
                          }
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-300"
                          aria-label={`Удалить ${u.email}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-zinc-900">
                  Удалить пользователя?
                </h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Пользователь{" "}
                  <span className="font-semibold text-zinc-900">
                    {deleteTarget.email}
                  </span>{" "}
                  и все связанные данные будут безвозвратно удалены из базы.
                  Это действие нельзя отменить.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(225,29,72,0.3)] transition hover:bg-rose-700 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Удаляем…" : "Удалить безвозвратно"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
