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
  const summary = result.summary as string | undefined;
  const leftSummary = result.left_document_summary as string | undefined;
  const rightSummary = result.right_document_summary as string | undefined;
  const commonPoints = result.common_points as string[] | undefined;
  const differences = result.differences as string[] | undefined;
  const relationAssessment = result.relation_assessment as string | undefined;
  const areRelated = result.are_documents_related as boolean | undefined;
  return (
    <>
      {summary ? <Section title="Итог сравнения">{summary}</Section> : null}
      {leftSummary ? <Section title="Документ слева">{leftSummary}</Section> : null}
      {rightSummary ? <Section title="Документ справа">{rightSummary}</Section> : null}
      {commonPoints?.length ? (
        <Section title="Общее">
          <ul className="list-disc pl-4">
            {commonPoints.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {differences?.length ? (
        <Section title="Различия">
          <ul className="list-disc pl-4">
            {differences.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {relationAssessment ? <Section title="Связь документов">{relationAssessment}</Section> : null}
      {areRelated != null ? <Section title="Вывод">{areRelated ? "Документы связаны" : "Документы о разном"}</Section> : null}
    </>
  );
}

function renderTenderAnalyzer(result: Record<string, unknown>) {
  const summary = result.summary as string | undefined;
  const disputeOverview = result.dispute_overview as string | undefined;
  const regions = result.regions as string[] | undefined;
  const courtPositions = result.court_positions as Array<{ court?: string; position?: string; relevance?: string }> | undefined;
  const citedCases = result.cited_cases as Array<{ title?: string; citation?: string; url?: string; takeaway?: string }> | undefined;
  const legalBasis = result.legal_basis as string[] | undefined;
  const practicalTakeaways = result.practical_takeaways as string[] | undefined;
  return (
    <>
      {summary != null && <Section title="Резюме">{summary}</Section>}
      {disputeOverview ? <Section title="Контекст спора">{disputeOverview}</Section> : null}
      {regions?.length ? (
        <Section title="Регионы">
          <ul className="list-disc pl-4">
            {regions.map((region, i) => (
              <li key={i}>{region}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {courtPositions?.length ? (
        <Section title="Подходы судов">
          <ul className="list-disc pl-4">
            {courtPositions.map((item, i) => (
              <li key={i}>
                {item.court}: {item.position} {item.relevance ? `(${item.relevance})` : ""}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {citedCases?.length ? (
        <Section title="Судебные акты">
          <ul className="list-disc pl-4">
            {citedCases.map((item, i) => (
              <li key={i}>
                {item.title} — {item.citation} {item.takeaway ? `(${item.takeaway})` : ""}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {legalBasis?.length ? (
        <Section title="Нормы права">
          <ul className="list-disc pl-4">
            {legalBasis.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {practicalTakeaways?.length ? (
        <Section title="Практические выводы">
          <ul className="list-disc pl-4">
            {practicalTakeaways.map((item, i) => (
              <li key={i}>{item}</li>
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
