import { Header } from "@/components/layout/Header";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate">
      <Header />
      <div className="relative z-0">{children}</div>
    </div>
  );
}
