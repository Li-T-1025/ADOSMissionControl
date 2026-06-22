// Immersive Fly cockpit route layout.
//
// Renders a full-screen, chromeless container: no navbar, no sidebar, none of
// the CommandShell chrome. Root providers (ConvexClientProvider, LocaleProvider,
// ToastProvider) still wrap this subtree via src/app/layout.tsx, so the cockpit
// gets useTranslations / useToast / Convex — but CommandShell short-circuits for
// /fly paths, so children here get the providers without the GCS UI.

export default function FlyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden">
      {children}
    </div>
  );
}
