import Link from "next/link";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import { ArrowRight, CheckCircle2, Clock3, Sparkles, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { tools } from "@/lib/config/tools";

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-home-display",
  weight: ["500", "600", "700"],
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-home-body",
  weight: ["400", "500", "600"],
});

const focusPoints = [
  "Проверка рисков и спорных формулировок",
  "Выделение сроков, штрафов и обязательств",
  "Сравнение редакций и контроль изменений",
];

const valueCards = [
  {
    title: "Юридическая точность",
    description: "Структурирует ключевые условия договоров и показывает места, где чаще всего возникают претензии.",
    icon: ShieldCheck,
  },
  {
    title: "Скорость решений",
    description: "Собирает суть документа и спорные фрагменты за минуты вместо ручного чтения на десятки страниц.",
    icon: Clock3,
  },
  {
    title: "Единый контур работы",
    description: "Загрузка, анализ, сравнение и экспорт находятся в одном интерфейсе без переключения между сервисами.",
    icon: Sparkles,
  },
];

export default function HomePage() {
  return (
    <main
      className={`${displayFont.variable} ${bodyFont.variable} relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_10%,rgba(16,185,129,0.2),transparent_34%),radial-gradient(circle_at_88%_2%,rgba(59,130,246,0.18),transparent_35%),linear-gradient(180deg,#f9faf9_0%,#f3f6fb_48%,#f8f7f4_100%)] text-zinc-900`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.42),rgba(255,255,255,0))]" />
      <section className="relative mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8 lg:pb-20 lg:pt-20">
        <div className="grid items-stretch gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="home-fade-up rounded-[34px] border border-zinc-200/90 bg-white/78 p-7 shadow-[0_30px_100px_rgba(15,23,42,0.12)] backdrop-blur md:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700 [font-family:var(--font-home-body)]">
              <Sparkles className="h-3.5 w-3.5" />
              AI-платформа для договоров
            </div>
            <h1 className="mt-6 text-4xl leading-[1.02] tracking-[-0.03em] text-zinc-900 sm:text-5xl lg:text-6xl [font-family:var(--font-home-display)]">
              SmartAnalyzer
              <br />
              читает документы
              <br />
              быстрее, чем дедлайны.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg [font-family:var(--font-home-body)]">
              Загружайте договоры, приложения и рукописные документы, чтобы получать структурированное резюме,
              риски, различия между версиями и готовые выводы для команды.
            </p>
            <div className="mt-9 flex flex-wrap gap-3 [font-family:var(--font-home-body)]">
              <Button href="/tools" className="rounded-full bg-zinc-900 px-6 hover:bg-zinc-800 focus:ring-zinc-700">
                Открыть инструменты
              </Button>
              <Button
                href="/pricing"
                variant="secondary"
                className="rounded-full border-zinc-300 bg-white/85 px-6 hover:bg-white"
              >
                Смотреть тарифы
              </Button>
            </div>
            <div className="mt-8 grid gap-2 sm:grid-cols-3">
              {focusPoints.map((point, index) => (
                <div
                  key={point}
                  className="home-fade-up rounded-2xl border border-zinc-200 bg-zinc-50/75 px-3 py-3 text-sm text-zinc-700 [font-family:var(--font-home-body)]"
                  style={{ animationDelay: `${0.12 + index * 0.09}s` }}
                >
                  {point}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-zinc-200 bg-white/85 p-4 [font-family:var(--font-home-body)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Безопасность данных</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-700">
                <p className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <span>В нейросеть попадают только обезличенные данные.</span>
                </p>
                <p className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <span>Все ваши диалоги полностью зашифрованы и недоступны даже для нас. Мы используем алгоритм шифрования AES-GCM для максимальной защиты данных.</span>
                </p>
              </div>
            </div>
          </div>
          <div className="home-glow-shift rounded-[34px] border border-zinc-800/80 bg-[linear-gradient(170deg,rgba(11,14,22,0.96),rgba(7,10,16,0.97))] p-6 text-zinc-100 shadow-[0_35px_110px_rgba(2,6,23,0.46)] [font-family:var(--font-home-body)] md:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300">Операционный режим</p>
            <h2 className="mt-4 text-3xl leading-tight tracking-[-0.02em] [font-family:var(--font-home-display)]">
              Всё по делу:
              <br />
              от загрузки
              <br />
              до результата.
            </h2>
            <div className="mt-7 space-y-3">
              {[
                "Поддержка PDF, DOCX, XLSX и изображений",
                "Папки, перетаскивание и управление историей анализов",
                "Экспорт структурированных данных без ручной разметки",
              ].map((item, index) => (
                <div
                  key={item}
                  className="home-fade-up flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-200"
                  style={{ animationDelay: `${0.15 + index * 0.08}s` }}
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <Link
              href="/dashboard"
              className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
            >
              Перейти в кабинет
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[34px] border border-zinc-200/80 bg-white/88 p-6 shadow-[0_22px_80px_rgba(15,23,42,0.1)] backdrop-blur md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 [font-family:var(--font-home-body)]">
                Инструменты
              </p>
              <h2 className="mt-2 text-3xl tracking-[-0.03em] text-zinc-900 [font-family:var(--font-home-display)]">
                Рабочий набор для юридической аналитики
              </h2>
            </div>
            <Button href="/tools" variant="secondary" className="rounded-full border-zinc-300 bg-zinc-50 px-5">
              Все инструменты
            </Button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tools.map((tool, index) => (
              <article
                key={tool.slug}
                className="home-fade-up rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,#ffffff,#fafafa)] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_16px_46px_rgba(15,23,42,0.12)]"
                style={{ animationDelay: `${0.08 + index * 0.06}s` }}
              >
                <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 [font-family:var(--font-home-body)]">
                  {tool.category}
                </div>
                <h3 className="mt-4 text-xl leading-tight text-zinc-900 [font-family:var(--font-home-display)]">
                  {tool.title}
                </h3>
                <p className="mt-2 min-h-16 text-sm leading-relaxed text-zinc-600 [font-family:var(--font-home-body)]">
                  {tool.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tool.mvp.accepts.slice(0, 3).map((format) => (
                    <span
                      key={`${tool.slug}-${format}`}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 [font-family:var(--font-home-body)]"
                    >
                      {format}
                    </span>
                  ))}
                </div>
                <Link
                  href={`/tools/${tool.slug}`}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900 transition hover:text-emerald-700 [font-family:var(--font-home-body)]"
                >
                  Открыть инструмент
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {valueCards.map((card, index) => (
            <article
              key={card.title}
              className="home-fade-up rounded-[28px] border border-zinc-200 bg-white/90 p-6 shadow-[0_18px_56px_rgba(15,23,42,0.08)]"
              style={{ animationDelay: `${0.1 + index * 0.09}s` }}
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                <card.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-2xl tracking-[-0.02em] text-zinc-900 [font-family:var(--font-home-display)]">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600 [font-family:var(--font-home-body)]">
                {card.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <div className="rounded-[34px] border border-zinc-900/85 bg-[linear-gradient(165deg,rgba(10,14,24,0.98),rgba(16,26,37,0.96))] px-6 py-10 text-center text-white shadow-[0_34px_120px_rgba(2,6,23,0.5)] md:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-300 [font-family:var(--font-home-body)]">
            Готово к работе
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl text-4xl leading-tight tracking-[-0.02em] [font-family:var(--font-home-display)]">
            Запустите первый анализ сейчас
            <br />
            и получите результат за пару минут.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 [font-family:var(--font-home-body)]">
            <Button href="/tools/document-analyzer" className="rounded-full bg-emerald-500 px-6 text-zinc-950 hover:bg-emerald-400 focus:ring-emerald-300">
              Начать анализ
            </Button>
            <Button href="/pricing" variant="secondary" className="rounded-full border-white/20 bg-white/10 px-6 text-white hover:bg-white/20">
              Выбрать тариф
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
