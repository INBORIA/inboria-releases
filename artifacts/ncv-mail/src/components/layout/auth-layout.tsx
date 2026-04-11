import appLogo from "@assets/inboria_logo_premium_transparent_v2_1775914256376.png";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <Link href="/" className="absolute top-6 left-6 flex items-center gap-1.5 text-[13px] text-[#8b9cb3] hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Retour au site
      </Link>
      <div className="w-full max-w-md bg-card rounded-xl border border-border overflow-hidden shadow-lg">
        <div className="p-8">
          <div className="flex justify-center mb-8">
            <img src={appLogo} alt="Inboria" className="h-20 w-auto object-contain" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
