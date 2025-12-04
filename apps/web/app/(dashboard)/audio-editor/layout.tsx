export default function AudioEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Override le layout dashboard pour etre full-screen
  return (
    <div className="fixed inset-0 bg-slate-900 z-50">
      {children}
    </div>
  );
}
