"use client";

type AnalysisRendererProps = {
  toolSlug: string;
  result: Record<string, unknown>;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="mb-2 text-sm font-semibold text-gray-700">{title}</h4>
      <div className="text-sm text-gray-600">{children}</div>
    </div>
  );
}

function renderDocumentAnalyzer(result: Record<string, unknown>) {
  const summary = result.summary as string | undefined;
  const keyPoints = result.key_points as string[] | undefined;
  const risks = result.risks as string[] | undefined;
  const importantDates = result.important_dates as Array<{ date?: string; description?: string }> | undefined;
  return (
    <>
      {summary != null && <Section title="Резюме">{summary}</Section>}
      {keyPoints?.length ? (
        <Section title="Ключевые пункты">
          <ul className="list-disc pl-4">
            {keyPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {risks?.length ? (
        <Section title="Риски">
          <ul className="list-disc pl-4">
            {risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {importantDates?.length ? (
        <Section title="Важные даты">
          <ul className="list-disc pl-4">
            {importantDates.map((d, i) => (
              <li key={i}>
                {d.date ?? ""} — {d.description ?? ""}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

function renderContractChecker(result: Record<string, unknown>) {
  const summary = result.summary as string | undefined;
  const riskyClauses = result.risky_clauses as Array<{ title?: string; reason?: string; severity?: string }> | undefined;
  const penalties = result.penalties as Array<{ trigger?: string; amount_or_formula?: string }> | undefined;
  const obligations = result.obligations as Array<{ party?: string; text?: string }> | undefined;
  const deadlines = result.deadlines as Array<{ date?: string; description?: string }> | undefined;
  const checklist = result.checklist as Array<{ item?: string; status?: string; note?: string }> | undefined;
  return (
    <>
      {summary != null && <Section title="Резюме">{summary}</Section>}
      {riskyClauses?.length ? (
        <Section title="Рисковые пункты">
          <ul className="list-disc pl-4">
            {riskyClauses.map((c, i) => (
              <li key={i}>
                {c.title} — {c.reason} ({c.severity})
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {penalties?.length ? (
        <Section title="Штрафы">
          <ul className="list-disc pl-4">
            {penalties.map((p, i) => (
              <li key={i}>
                {p.trigger} — {p.amount_or_formula}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {obligations?.length ? (
        <Section title="Обязательства">
          <ul className="list-disc pl-4">
            {obligations.map((o, i) => (
              <li key={i}>
                {o.party}: {o.text}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {deadlines?.length ? (
        <Section title="Сроки">
          <ul className="list-disc pl-4">
            {deadlines.map((d, i) => (
              <li key={i}>
                {d.date} — {d.description}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {checklist?.length ? (
        <Section title="Чеклист">
          <ul className="list-disc pl-4">
            {checklist.map((c, i) => (
              <li key={i}>
                {c.item} [{c.status}] {c.note ? `— ${c.note}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

function renderDataExtractor(result: Record<string, unknown>) {
  const fields = result.fields as Array<{ key?: string; value?: string }> | undefined;
  const tables = result.tables as Array<{ name?: string; rows?: string[][] }> | undefined;
  const confidence = result.confidence as number | undefined;
  return (
    <>
      {confidence != null && (
        <Section title="Уверенность">{String(confidence)}</Section>
      )}
      {fields?.length ? (
        <Section title="Поля">
          <dl className="space-y-1">
            {fields.map((f, i) => (
              <div key={i}>
                <dt className="font-medium">{f.key}</dt>
                <dd className="pl-4">{f.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}
      {tables?.length ? (
        <Section title="Таблицы">
          {tables.map((t, i) => (
            <div key={i} className="mb-2 overflow-x-auto">
              <p className="font-medium">{t.name}</p>
              <table className="min-w-full border border-gray-200 text-sm">
                <tbody>
                  {t.rows?.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="border border-gray-200 px-2 py-1">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </Section>
      ) : null}
    </>
  );
}

function renderTenderAnalyzer(result: Record<string, unknown>) {
  const summary = result.summary as string | undefined;
  const requirements = result.requirements as Array<{ id?: string; text?: string; type?: string }> | undefined;
  const complianceChecklist = result.compliance_checklist as Array<{ item?: string; status?: string; note?: string }> | undefined;
  const deadlines = result.deadlines as Array<{ date?: string; description?: string }> | undefined;
  const risks = result.risks as Array<{ title?: string; severity?: string; reason?: string }> | undefined;
  return (
    <>
      {summary != null && <Section title="Резюме">{summary}</Section>}
      {requirements?.length ? (
        <Section title="Требования">
          <ul className="list-disc pl-4">
            {requirements.map((r, i) => (
              <li key={i}>
                {r.id} [{r.type}]: {r.text}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {complianceChecklist?.length ? (
        <Section title="Соответствие">
          <ul className="list-disc pl-4">
            {complianceChecklist.map((c, i) => (
              <li key={i}>
                {c.item} — {c.status} {c.note ? `(${c.note})` : ""}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {deadlines?.length ? (
        <Section title="Сроки">
          <ul className="list-disc pl-4">
            {deadlines.map((d, i) => (
              <li key={i}>
                {d.date} — {d.description}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {risks?.length ? (
        <Section title="Риски">
          <ul className="list-disc pl-4">
            {risks.map((r, i) => (
              <li key={i}>
                {r.title} [{r.severity}]: {r.reason}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

function renderRiskAnalyzer(result: Record<string, unknown>) {
  const riskScore = result.risk_score as number | undefined;
  const confidence = result.confidence as number | undefined;
  const keyRisks = result.key_risks as Array<{ title?: string; severity?: string; reason?: string }> | undefined;
  const riskDrivers = result.risk_drivers as Array<{ driver?: string; impact?: string; evidence?: string }> | undefined;
  const recommendations = result.recommendations as Array<{ action?: string; priority?: string; note?: string }> | undefined;
  return (
    <>
      {(riskScore != null || confidence != null) && (
        <Section title="Оценка">
          {riskScore != null && <p>Балл риска: {riskScore}</p>}
          {confidence != null && <p>Уверенность: {String(confidence)}</p>}
        </Section>
      )}
      {keyRisks?.length ? (
        <Section title="Ключевые риски">
          <ul className="list-disc pl-4">
            {keyRisks.map((r, i) => (
              <li key={i}>
                {r.title} [{r.severity}]: {r.reason}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {riskDrivers?.length ? (
        <Section title="Драйверы риска">
          <ul className="list-disc pl-4">
            {riskDrivers.map((d, i) => (
              <li key={i}>
                {d.driver} (влияние: {d.impact}) — {d.evidence}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {recommendations?.length ? (
        <Section title="Рекомендации">
          <ul className="list-disc pl-4">
            {recommendations.map((r, i) => (
              <li key={i}>
                {r.action} [{r.priority}] {r.note ? `— ${r.note}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

export function AnalysisRenderer({ toolSlug, result }: AnalysisRendererProps) {
  switch (toolSlug) {
    case "document-analyzer":
      return renderDocumentAnalyzer(result);
    case "contract-checker":
      return renderContractChecker(result);
    case "data-extractor":
      return renderDataExtractor(result);
    case "tender-analyzer":
      return renderTenderAnalyzer(result);
    case "risk-analyzer":
      return renderRiskAnalyzer(result);
    default:
      return (
        <pre className="overflow-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      );
  }
}
