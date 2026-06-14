/**
 * Auth route group layout. Wraps login + future auth pages in a
 * centered card on a soft slate background so the focus is on the form.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12">
      {children}
    </main>
  );
}
