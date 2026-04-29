import { notFound } from "next/navigation";
import { getToolBySlug, TOOL_SLUGS } from "@/lib/config/tools";
import { ToolPageClient } from "./ToolPageClient";

export function generateStaticParams() {
  return TOOL_SLUGS.map((slug) => ({ slug }));
}

export default function ToolPage({ params }: { params: { slug: string } }) {
  const tool = getToolBySlug(params.slug);

  if (!tool) {
    notFound();
  }

  return <ToolPageClient tool={tool} />;
}
