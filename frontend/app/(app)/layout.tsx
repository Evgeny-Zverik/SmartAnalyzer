export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate">
      <div className="relative z-0">{children}</div>
    </div>
  );
}
