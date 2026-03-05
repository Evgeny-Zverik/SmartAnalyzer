"use client";

import { Card } from "@/components/ui/Card";

type TableItem = {
  name: string;
  rows: string[][];
};

type TablesViewProps = {
  tables: TableItem[];
};

export function TablesView({ tables }: TablesViewProps) {
  if (tables.length === 0) {
    return (
      <p className="text-sm text-gray-500">Нет извлечённых таблиц</p>
    );
  }
  return (
    <div className="space-y-4">
      {tables.map((t, i) => (
        <Card key={i}>
          <h4 className="mb-3 text-sm font-semibold text-gray-700">{t.name}</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 text-sm">
              <tbody>
                {t.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="border border-gray-200 px-2 py-1.5 text-gray-600"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
