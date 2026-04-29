import Link from "next/link";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileSearch,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HomeToolsGrid } from "@/components/marketing/HomeToolsGrid";

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

const proofPoints = [
  { value: "2-3 мин", label: "до первого отчета по договору" },
  { value: "PDF, DOCX, сканы", label: "без ручной подготовки текста" },
  { value: "Без карты", label: "можно начать с бесплатной проверки" },
];

const sampleFindings = [
  {
    title: "Штраф растет каждый день",
    detail: "Пункт 7.4: 0,5% за каждый день просрочки без верхнего лимита.",
    icon: AlertTriangle,
    tone: "rose",
  },
  {
    title: "Срок уведомления слишком короткий",
    detail: "Пункт 5.2: уведомить контрагента нужно за 3 рабочих дня.",
    icon: Clock3,
    tone: "amber",
  },
  {
    title: "Есть одностороннее изменение условий",
    detail: "Пункт 9.1 позволяет менять порядок оплаты без согласования.",
    icon: Scale,
    tone: "emerald",
  },
];

const scenarioCards = [
  {
    title: "Перед подписанием договора",
    description:
      "Быстро увидеть штрафы, сроки, обязанности и спорные формулировки до согласования.",
    icon: FileSearch,
  },
  {
    title: "Когда прислали новую редакцию",
    description:
      "Понять, что изменилось по пунктам, и не пропустить правки в оплате, сроках или ответственности.",
    icon: Scale,
  },
  {
    title: "Когда документ конфиденциален",
    description:
      "Перед отправкой в модель данные обезличиваются, а диалоги шифруются AES-GCM.",
    icon: LockKeyhole,
  },
];

const valueCards = [
  {
    title: "Юридическая точность",
    description:
      "Структурирует ключевые условия договоров и показывает места, где чаще всего возникают претензии.",
    icon: ShieldCheck,
  },
  {
    title: "Скорость решений",
    description:
      "Собирает суть документа и спорные фрагменты за минуты вместо ручного чтения на десятки страниц.",
    icon: Clock3,
  },
  {
    title: "Единый контур работы",
    description:
      "Загрузка, анализ, сравнение и экспорт находятся в одном интерфейсе без переключения между сервисами.",
    icon: Sparkles,
  },
];

const faqItems = [
  {
    question: "Можно ли загрузить конфиденциальный договор?",
    answer:
      "Да. Перед отправкой в модель персональные и чувствительные данные обезличиваются, а диалоги шифруются. Для особо чувствительных файлов все равно стоит убрать коммерческие тайны, которые не нужны для анализа.",
  },
  {
    question: "Данные используются для обучения модели?",
    answer:
      "Главная задача SmartAnalyzer - провести анализ документа внутри рабочего контура. Если политика обработки данных меняется, это должно быть явно отражено в условиях сервиса.",
  },
  {
    question: "Что пользователь получает после анализа?",
    answer:
      "Краткое резюме, риски, сроки, обязательства, спорные формулировки и выводы по конкретным пунктам документа.",
  },
  {
    question: "Чем это лучше обычного чата с GPT?",
    answer:
      "Не нужно вручную готовить промпт, дробить большой файл и сверять редакции. Инструменты заточены под документы, OCR, сравнение и юридическую структуру вывода.",
  },
];

export default function HomePage() {
  return (
    <main
      className={`${displayFont.variable} ${bodyFont.variable} relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_10%,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_88%_2%,rgba(59,130,246,0.14),transparent_35%),linear-gradient(180deg,#f9faf9_0%,#f3f6fb_48%,#f8f7f4_100%)] text-zinc-900`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.42),rgba(255,255,255,0))]" />

      <section className="relative mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 lg:px-8 lg:pb-14 lg:pt-14">
        <div className="grid items-stretch gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="home-fade-up rounded-[34px] border border-zinc-200/90 bg-white/82 p-6 shadow-[0_30px_100px_rgba(15,23,42,0.12)] backdrop-blur md:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 [font-family:var(--font-home-body)]">
              <Sparkles className="h-3.5 w-3.5" />
              Проверка договора за минуты
            </div>
            <h1 className="mt-5 text-4xl leading-[1.02] tracking-[-0.03em] text-zinc-900 sm:text-5xl lg:text-6xl [font-family:var(--font-home-display)]">
              Найдите риски
              <br />
              в договоре до того,
              <br />
              как его подпишут.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg [font-family:var(--font-home-body)]">
              Загрузите PDF, DOCX или скан и получите резюме, штрафы, сроки,
              обязательства и спорные формулировки с привязкой к пунктам
              документа.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 [font-family:var(--font-home-body)]">
              <Button
                href="/tools/document-analyzer"
                className="rounded-full bg-zinc-900 px-6 hover:bg-zinc-800 focus:ring-zinc-700"
              >
                Проверить документ бесплатно
              </Button>
              <Link
                href="#example"
                className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white/85 px-5 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-white"
              >
                Посмотреть пример отчета
              </Link>
            </div>
            <div className="mt-7 grid gap-2 sm:grid-cols-3">
              {proofPoints.map((point, index) => (
                <div
                  key={point.value}
                  className="home-fade-up rounded-2xl border border-zinc-200 bg-zinc-50/75 px-3 py-3 [font-family:var(--font-home-body)]"
                  style={{ animationDelay: `${0.12 + index * 0.09}s` }}
                >
                  <p className="text-sm font-semibold text-zinc-950">
                    {point.value}
                  </p>
                  <p className="mt-1 text-xs leading-snug text-zinc-600">
                    {point.label}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 [font-family:var(--font-home-body)]">
              <p className="flex items-start gap-3 text-sm leading-6 text-zinc-700">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span>
                  Данные обезличиваются перед отправкой в модель. Диалоги
                  шифруются AES-GCM и недоступны для просмотра даже со стороны
                  сервиса.
                </span>
              </p>
            </div>
          </div>

          <div
            id="example"
            className="home-glow-shift rounded-[34px] border border-zinc-800/80 bg-[linear-gradient(170deg,rgba(11,14,22,0.96),rgba(7,10,16,0.97))] p-5 text-zinc-100 shadow-[0_35px_110px_rgba(2,6,23,0.46)] [font-family:var(--font-home-body)] md:p-7"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300">
                  Пример отчета
                </p>
                <h2 className="mt-3 text-3xl leading-tight tracking-[-0.02em] [font-family:var(--font-home-display)]">
                  Договор поставки
                  <br />
                  18 страниц
                </h2>
              </div>
              <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-right">
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200">
                  Готово
                </p>
                <p className="mt-1 text-lg font-semibold text-white">2:14</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {sampleFindings.map((item, index) => (
                <div
                  key={item.title}
                  className="home-fade-up rounded-2xl border border-white/10 bg-white/[0.06] p-4"
                  style={{ animationDelay: `${0.15 + index * 0.08}s` }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                        item.tone === "rose"
                          ? "border-rose-300/30 bg-rose-400/10 text-rose-200"
                          : item.tone === "amber"
                            ? "border-amber-300/30 bg-amber-400/10 text-amber-200"
                            : "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                Вывод
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                До подписания стоит ограничить размер штрафа, увеличить срок
                уведомления и убрать право одностороннего изменения оплаты.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {scenarioCards.map((card, index) => (
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

      <section className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[34px] border border-zinc-200/80 bg-white/88 p-6 shadow-[0_22px_80px_rgba(15,23,42,0.1)] backdrop-blur md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 [font-family:var(--font-home-body)]">
                Что внутри
              </p>
              <h2 className="mt-2 text-3xl tracking-[-0.03em] text-zinc-900 [font-family:var(--font-home-display)]">
                Инструменты под реальные юридические задачи
              </h2>
            </div>
            <Button
              href="/tools/document-analyzer"
              variant="secondary"
              className="rounded-full border-zinc-300 bg-zinc-50 px-5"
            >
              Начать с анализа договора
            </Button>
          </div>
          <HomeToolsGrid />
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

      <section className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[34px] border border-zinc-200/80 bg-white/88 p-6 shadow-[0_22px_80px_rgba(15,23,42,0.1)] backdrop-blur md:p-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 [font-family:var(--font-home-body)]">
              Сравнение
            </p>
            <h2 className="mt-2 text-3xl tracking-[-0.03em] text-zinc-900 sm:text-4xl [font-family:var(--font-home-display)]">
              Чем SmartAnalyzer лучше обычного GPT
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 [font-family:var(--font-home-body)]">
              ChatGPT - универсальный ассистент. SmartAnalyzer - отраслевая
              платформа для договоров, заточенная под юридические задачи и
              работу с длинными документами.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {[
              {
                title: "Понимает длинные договоры целиком",
                gpt: "Теряет контекст на больших файлах, пропускает приложения и пункты в середине документа.",
                us: "Обрабатывает документы целиком, включая приложения и сноски, без обрезки контекста.",
              },
              {
                title: "Юридическая экспертиза, а не общие советы",
                gpt: "Дает обтекаемые формулировки и часто галлюцинирует статьи закона.",
                us: "Структурирует риски, ссылается на конкретные пункты договора и подсвечивает спорные формулировки.",
              },
              {
                title: "Работа с PDF, DOCX, XLSX и сканами",
                gpt: "Принимает текст, плохо справляется со сканами и рукописью.",
                us: "Встроенный OCR для сканов и рукописных документов, корректное чтение таблиц и форм.",
              },
              {
                title: "Сравнение редакций и контроль изменений",
                gpt: "Ручная вставка двух версий в чат, без структурного diff.",
                us: "Сравнение редакций пункт-в-пункт с подсветкой изменений и риск-оценкой.",
              },
              {
                title: "Безопасность и обезличивание",
                gpt: "Данные уходят в общий продукт, обезличивания нет.",
                us: "Обезличивание перед отправкой в модель, AES-GCM шифрование диалогов, доступ закрыт даже для нас.",
              },
              {
                title: "Готовые инструменты под задачу",
                gpt: "Один чат на все случаи - каждый раз заново формулируешь промпт.",
                us: "Отдельные инструменты: проверка рисков, перевод юридического стиля, упрощение текста и редизайн документа.",
              },
            ].map((row, index) => (
              <article
                key={row.title}
                className="home-fade-up rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,#ffffff,#fafafa)] p-5 [font-family:var(--font-home-body)]"
                style={{ animationDelay: `${0.08 + index * 0.06}s` }}
              >
                <h3 className="text-lg leading-tight tracking-[-0.01em] text-zinc-900 [font-family:var(--font-home-display)]">
                  {row.title}
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      <X className="h-3.5 w-3.5 text-zinc-400" />
                      GPT
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                      {row.gpt}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      SmartAnalyzer
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-700">
                      {row.us}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[34px] border border-zinc-200/80 bg-white/88 p-6 shadow-[0_22px_80px_rgba(15,23,42,0.1)] backdrop-blur md:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 [font-family:var(--font-home-body)]">
            Вопросы перед стартом
          </p>
          <h2 className="mt-2 text-3xl tracking-[-0.03em] text-zinc-900 sm:text-4xl [font-family:var(--font-home-display)]">
            Что обычно мешает попробовать
          </h2>
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {faqItems.map((item) => (
              <article
                key={item.question}
                className="rounded-2xl border border-zinc-200 bg-white p-5"
              >
                <h3 className="text-lg leading-tight text-zinc-900 [font-family:var(--font-home-display)]">
                  {item.question}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600 [font-family:var(--font-home-body)]">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <div className="rounded-[34px] border border-zinc-900/85 bg-[linear-gradient(165deg,rgba(10,14,24,0.98),rgba(16,26,37,0.96))] px-6 py-10 text-center text-white shadow-[0_34px_120px_rgba(2,6,23,0.5)] md:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-300 [font-family:var(--font-home-body)]">
            Готово к работе
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl text-4xl leading-tight tracking-[-0.02em] [font-family:var(--font-home-display)]">
            Загрузите первый договор
            <br />и получите отчет за пару минут.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 [font-family:var(--font-home-body)]">
            <Button
              href="/tools/document-analyzer"
              className="rounded-full bg-emerald-500 px-6 text-zinc-950 hover:bg-emerald-400 focus:ring-emerald-300"
            >
              Проверить документ бесплатно
            </Button>
            <Button
              href="/pricing"
              variant="secondary"
              className="rounded-full border-white/20 bg-white/10 px-6 text-white hover:bg-white/20"
            >
              Посмотреть кредиты
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
