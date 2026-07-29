// Layout neutro do /admin — apenas garante body/min-height.
// Sub-grupos (login, dashboard) aplicam seu próprio layout.

export default function AdminBaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
