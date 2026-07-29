/**
 * Layout dedicado para o stand 3D — fullscreen, sem nada do site público.
 */
export default function TouchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-slate-950 overflow-hidden">
      {children}
    </div>
  );
}
