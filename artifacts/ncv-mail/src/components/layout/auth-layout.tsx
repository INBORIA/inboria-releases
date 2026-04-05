import ncvLogo from "@assets/Logo-NCV-Instagram_1775391389822.jpg";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-xl border border-border overflow-hidden shadow-lg">
        <div className="p-8">
          <div className="flex justify-center mb-8">
            <img src={ncvLogo} alt="NCV" className="h-20 w-20 rounded-xl object-cover shadow-md" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
