"use client";

import Link from "next/link";
import { IBM_Plex_Sans } from "next/font/google";
import { useEffect, useState, type MouseEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileSearch,
  HelpCircle,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { HomeToolsGrid } from "@/components/marketing/HomeToolsGrid";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-home-body",
  weight: ["400", "500", "600", "700"],
});

const proofPoints = [
  { value: "2-3 мин", label: "до первого отчета" },
  { value: "PDF, DOCX, сканы", label: "без ручной подготовки" },
  { value: "Без карты", label: "старт с бесплатной проверки" },
];

const sampleFindings = [
  {
    title: "Штраф без верхнего лимита",
    detail: "Пункт 7.4: 0,5% за каждый день просрочки.",
    icon: AlertTriangle,
    tone: "risk",
  },
  {
    title: "Срок уведомления короткий",
    detail: "Пункт 5.2: всего 3 рабочих дня на ответ.",
    icon: Clock3,
    tone: "warning",
  },
  {
    title: "Одностороннее изменение оплаты",
    detail: "Пункт 9.1 разрешает менять порядок оплаты без согласования.",
    icon: Scale,
    tone: "info",
  },
];

const scenarioCards = [
  {
    title: "Перед подписанием",
    description:
      "Проверить штрафы, сроки, обязанности и спорные формулировки до согласования.",
    icon: FileSearch,
  },
  {
    title: "После новой редакции",
    description:
      "Понять, что изменилось в оплате, ответственности и ключевых условиях.",
    icon: Scale,
  },
  {
    title: "Для конфиденциальных файлов",
    description:
      "Обезличивание перед моделью и AES-GCM шифрование рабочих диалогов.",
    icon: LockKeyhole,
    detail:
      "Перед обработкой мы стараемся скрыть персональные и чувствительные данные, чтобы модель видела меньше лишней информации. Рабочие диалоги шифруются AES-GCM: это современный алгоритм, который защищает содержимое от чтения без ключа. Такой подход помогает аккуратнее работать с требованиями 152-ФЗ о персональных данных и 149-ФЗ о защите информации: мы уменьшаем объем раскрываемых данных и не храним диалоги как открытый текст.",
  },
];

const valueCards = [
  {
    title: "Ссылки на пункты договора",
    description:
      "Риски привязаны к конкретным местам документа, а не к общим советам.",
    icon: FileSearch,
  },
  {
    title: "Юридическая структура вывода",
    description:
      "Сводка, риски, сроки, обязательства и рекомендуемые правки в одном отчете.",
    icon: Scale,
  },
  {
    title: "Рабочий контур без лишних шагов",
    description:
      "Загрузка, анализ, редактирование и экспорт собраны в одном интерфейсе.",
    icon: Sparkles,
  },
];

const faqItems = [
  {
    question: "Можно загрузить конфиденциальный договор?",
    answer:
      "Да. Перед отправкой в модель чувствительные данные обезличиваются, а диалоги шифруются. Коммерческие тайны, не нужные для анализа, лучше удалить заранее.",
  },
  {
    question: "Что будет в первом отчете?",
    answer:
      "Краткое резюме, риски, сроки, обязательства, спорные формулировки и выводы с привязкой к пунктам договора.",
  },
  {
    question: "Чем это лучше обычного GPT?",
    answer:
      "Не нужно дробить файл, писать промпт и вручную сверять редакции. Инструмент уже заточен под юридический документ.",
  },
  {
    question: "Нужна ли карта для старта?",
    answer:
      "Нет. Можно начать с бесплатной проверки и понять качество отчета до оплаты.",
  },
];

function toneClass(tone: string): string {
  if (tone === "risk") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export default function HomePage() {
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [reportHighlighted, setReportHighlighted] = useState(false);
  const securityDetail =
    scenarioCards.find((card) => "detail" in card)?.detail ?? "";

  useEffect(() => {
    if (!securityModalOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSecurityModalOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [securityModalOpen]);

  function handleReportPreviewClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    document.getElementById("example")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    setReportHighlighted(true);
    window.setTimeout(() => setReportHighlighted(false), 2200);
  }

  return (
    <main
      className={`${bodyFont.variable} min-h-screen overflow-hidden bg-[#f5f6f7] text-zinc-950 [font-family:var(--font-home-body)]`}
    >
      <section className="relative border-b border-zinc-200 bg-[#f5f6f7]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_520px] lg:px-8 lg:py-12">
          <div className="home-fade-up flex min-h-[560px] flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              AI-анализ договоров с обезличиванием
            </div>

            <h1 className="max-w-3xl text-4xl font-bold leading-tight text-zinc-950 sm:text-6xl sm:leading-none lg:text-7xl">
              Найдите риск в договоре до подписи
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
              Загрузите PDF, DOCX или скан. SmartAnalyzer покажет штрафы,
              сроки, обязанности и спорные формулировки с привязкой к пунктам
              документа.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/tools/document-analyzer"
                className="inline-flex items-center justify-center rounded-[18px] bg-[#ffd43b] px-6 py-3 text-base font-semibold text-zinc-950 shadow-[0_10px_30px_rgba(234,179,8,0.24)] transition hover:bg-[#f6c343] focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2"
              >
                Проверить документ бесплатно
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="#example"
                onClick={handleReportPreviewClick}
                className="inline-flex items-center justify-center rounded-[18px] border border-zinc-300 bg-white px-6 py-3 text-base font-semibold text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50"
              >
                Посмотреть пример отчета
              </Link>
            </div>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {proofPoints.map((point) => (
                <div
                  key={point.value}
                  className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-lg font-bold text-zinc-950">
                    {point.value}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-zinc-500">
                    {point.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div
            id="example"
            className="home-fade-up flex items-center"
            style={{ animationDelay: "90ms" }}
          >
            <div
              className={`w-full overflow-hidden rounded-[36px] border bg-white shadow-[0_24px_80px_rgba(15,23,42,0.14)] transition ${
                reportHighlighted
                  ? "border-amber-300 ring-4 ring-amber-300/70 shadow-[0_0_0_8px_rgba(255,212,59,0.2),0_30px_100px_rgba(234,179,8,0.32)]"
                  : "border-zinc-200"
              }`}
            >
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-950 px-5 py-4 text-white">
                <div>
                  <p className="text-sm font-semibold text-amber-300">
                    Пример отчета
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">
                    Договор поставки, 18 страниц
                  </h2>
                </div>
                <div className="rounded-[16px] bg-emerald-500 px-3 py-2 text-sm font-bold text-zinc-950">
                  Готово 2:14
                </div>
              </div>

              <div className="border-b border-zinc-200 bg-[#fff8d7] px-5 py-4">
                <div className="flex items-start gap-3">
                  <UploadCloud className="mt-1 h-5 w-5 shrink-0 text-amber-700" />
                  <div>
                    <p className="font-semibold text-zinc-950">
                      Загружен договор.pdf
                    </p>
                    <p className="mt-1 text-sm leading-6 text-zinc-700">
                      Найдено 12 условий, 4 риска и 3 срока, которые требуют
                      внимания перед подписанием.
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-zinc-200">
                {sampleFindings.map((item) => (
                  <div key={item.title} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border ${toneClass(
                          item.tone,
                        )}`}
                      >
                        <item.icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-semibold text-zinc-950">
                          {item.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-zinc-600">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-zinc-50 px-5 py-5">
                <p className="text-sm font-semibold text-zinc-500">Вывод</p>
                <p className="mt-2 leading-7 text-zinc-800">
                  До подписания стоит ограничить размер штрафа, увеличить срок
                  уведомления и убрать право одностороннего изменения оплаты.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {scenarioCards.map((card, index) => (
            <article
              key={card.title}
              className="home-fade-up relative rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm"
              style={{ animationDelay: `${0.08 + index * 0.06}s` }}
            >
              <card.icon className="h-6 w-6 text-zinc-950" />
              <h3 className="mt-5 text-2xl font-bold text-zinc-950">
                {card.title}
              </h3>
              <p className="mt-3 leading-7 text-zinc-600">
                {card.description}
              </p>
              {"detail" in card ? (
                <button
                  type="button"
                  onClick={() => setSecurityModalOpen(true)}
                  className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2"
                  aria-label="Подробнее про шифрование"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div>
            <p className="text-sm font-semibold text-amber-700">Что внутри</p>
            <h2 className="mt-2 text-4xl font-bold leading-tight text-zinc-950">
              Инструменты под реальные юридические задачи
            </h2>
            <p className="mt-4 leading-7 text-zinc-600">
              Начните с анализа договора, а затем используйте сравнение,
              упрощение юридического текста и редактор результата.
            </p>
            <Link
              href="/tools/document-analyzer"
              className="mt-6 inline-flex items-center justify-center rounded-[18px] bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:ring-offset-2"
            >
              Начать анализ
            </Link>
          </div>
          <div>
            <HomeToolsGrid />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {valueCards.map((card, index) => (
            <article
              key={card.title}
              className="home-fade-up rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm"
              style={{ animationDelay: `${0.08 + index * 0.06}s` }}
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-[18px] bg-[#fff1a8] text-zinc-950">
                <card.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-2xl font-bold text-zinc-950">
                {card.title}
              </h3>
              <p className="mt-3 leading-7 text-zinc-600">
                {card.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[36px] border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-amber-700">Сравнение</p>
            <h2 className="mt-2 text-4xl font-bold leading-tight text-zinc-950">
              Не чат вместо юриста, а рабочий слой перед проверкой договора
            </h2>
            <p className="mt-4 leading-7 text-zinc-600">
              Обычный GPT помогает сформулировать мысль. SmartAnalyzer
              помогает разобрать сам документ: файл, пункты, риски, сроки и
              результат для дальнейшей работы.
            </p>
          </div>

          <div className="mt-8 overflow-hidden rounded-[28px] border border-zinc-200">
            {[
              [
                "Большой файл",
                "Ручная разбивка на части",
                "Загрузка PDF/DOCX/скана целиком",
              ],
              [
                "Риски",
                "Общие советы без структуры",
                "Риск, пункт договора и причина",
              ],
              [
                "Безопасность",
                "Нужно думать, что удалить вручную",
                "Обезличивание и шифрование в контуре сервиса",
              ],
            ].map(([label, gpt, smart]) => (
              <div
                key={label}
                className="grid gap-0 border-b border-zinc-200 last:border-b-0 md:grid-cols-[180px_1fr_1fr]"
              >
                <div className="bg-zinc-50 p-4 font-semibold text-zinc-950">
                  {label}
                </div>
                <div className="flex gap-3 p-4 text-zinc-600">
                  <X className="mt-1 h-4 w-4 shrink-0 text-zinc-400" />
                  <span>{gpt}</span>
                </div>
                <div className="flex gap-3 bg-emerald-50 p-4 text-zinc-800">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{smart}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-2">
          {faqItems.map((item) => (
            <article
              key={item.question}
              className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-zinc-950">
                {item.question}
              </h3>
              <p className="mt-3 leading-7 text-zinc-600">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="grid items-center gap-6 rounded-[36px] bg-zinc-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.2)] md:grid-cols-[1fr_auto] md:p-8">
          <div>
            <p className="text-sm font-semibold text-amber-300">
              Готово к первой проверке
            </p>
            <h2 className="mt-2 text-4xl font-bold leading-tight">
              Загрузите договор и получите отчет за пару минут.
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-zinc-300">
              Без карты, без ручного промпта, с примером результата сразу после
              анализа.
            </p>
          </div>
          <Link
            href="/tools/document-analyzer"
            className="inline-flex items-center justify-center rounded-[18px] bg-[#ffd43b] px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-[#f6c343] focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-zinc-950"
          >
            Проверить бесплатно
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </section>

      {securityModalOpen ? (
        <div
          className="fixed inset-0 z-[1600] flex items-center justify-center bg-[rgba(15,23,42,0.55)] px-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="security-modal-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSecurityModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-lg origin-center animate-[avatar-menu-in_220ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.32)]">
            <div className="relative overflow-hidden border-b border-stone-200 bg-[radial-gradient(circle_at_top,_rgba(255,212,59,0.28),rgba(255,255,255,0.96)_62%)] px-6 pb-5 pt-6">
              <span className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-200/50 blur-3xl" />
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSecurityModalOpen(false);
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSecurityModalOpen(false);
                }}
                className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white/90 text-stone-500 transition hover:bg-white hover:text-stone-950 focus:outline-none focus:ring-2 focus:ring-stone-400"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative flex items-start gap-3 pr-10">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-white text-stone-950 shadow-sm">
                  <LockKeyhole className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                    Конфиденциальные файлы
                  </p>
                  <h2
                    id="security-modal-title"
                    className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-stone-950"
                  >
                    Как защищаются данные
                  </h2>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-stone-600">
                    Простое объяснение без технических деталей.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm leading-7 text-stone-700">
                {securityDetail}
              </p>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-stone-700">
                <span className="font-semibold text-stone-950">
                  Главное:
                </span>{" "}
                сервису нужен файл, чтобы сделать анализ, но лишние
                персональные данные скрываются, а рабочие диалоги защищаются
                шифрованием.
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-stone-700">
                <span className="font-semibold text-stone-950">
                  Важно:
                </span>{" "}
                загрузка документа должна быть законной: у пользователя должно
                быть право обрабатывать файл и персональные данные в нем. Мы
                помогаем снизить риск раскрытия данных, но не заменяем согласие
                или другое правовое основание для обработки.
              </div>
              <button
                type="button"
                onClick={() => setSecurityModalOpen(false)}
                className="inline-flex w-full items-center justify-center rounded-[18px] bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
