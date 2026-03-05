"use client";

type FieldsTableProps = {
  fields: Array<{ key: string; value: string }>;
};

export function FieldsTable({ fields }: FieldsTableProps) {
  if (fields.length === 0) {
    return (
      <p className="text-sm text-gray-500">Нет извлечённых полей</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-200 text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
              Ключ
            </th>
            <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
              Значение
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="border border-gray-200 px-3 py-2 font-medium text-gray-900">
                {f.key}
              </td>
              <td className="border border-gray-200 px-3 py-2 text-gray-600">
                {f.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
