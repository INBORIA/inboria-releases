export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="p-8">
          <div className="flex justify-center mb-8">
            <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm">
              NCV
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
