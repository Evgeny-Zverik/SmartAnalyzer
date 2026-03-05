import { tools } from "@/lib/config/tools";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type ToolsGridProps = {
  showButton?: boolean;
  buttonText?: string;
};

export function ToolsGrid({
  showButton = true,
  buttonText = "Открыть",
}: ToolsGridProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <Card key={tool.slug}>
          <div className="flex h-full flex-col">
            <h3 className="text-lg font-semibold text-gray-900">{tool.title}</h3>
            <p className="mt-2 flex-1 text-sm text-gray-600">
              {tool.description}
            </p>
            {showButton && (
              <div className="mt-4">
                <Button
                  href={`/tools/${tool.slug}`}
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  {buttonText}
                </Button>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
