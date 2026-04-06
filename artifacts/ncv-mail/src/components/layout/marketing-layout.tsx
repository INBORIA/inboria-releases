import { Link, useLocation } from "wouter";
import ncvLogo from "@assets/image_1775392688923.png";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Accueil", href: "/" },
  { label: "Fonctionnalites", href: "/fonctionnalites" },
  { label: "Tarifs", href: "/tarifs" },
];

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col">
      <header className="sticky top-0 z-50 bg-[#0d1117]/95 backdrop-blur-sm border-b border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-28">
            <Link href="/" className="flex flex-col items-center">
              <img src={ncvLogo} alt="NCV Mail" className="h-24 w-24 object-contain" />
              <span className="font-bold text-sm tracking-tight text-white -mt-2">NCV Mail</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[14px] font-medium transition-colors ${
                    location === link.href ? "text-[#2d7dd2]" : "text-[#8b9cb3] hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <Link href="/login">
                <button className="px-4 py-2 text-[13px] font-medium text-[#2d7dd2] border border-[#2d7dd2] rounded-lg hover:bg-[#2d7dd2]/10 transition-colors">
                  Se connecter
                </button>
              </Link>
              <Link href="/tarifs">
                <button className="px-4 py-2 text-[13px] font-medium text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors">
                  S'inscrire
                </button>
              </Link>
            </div>

            <button
              className="md:hidden text-white p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {mobileOpen && (
            <div className="md:hidden pb-4 border-t border-[#1f2937] pt-4 space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block text-[14px] font-medium px-2 py-1.5 rounded ${
                    location === link.href ? "text-[#2d7dd2]" : "text-[#8b9cb3]"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex gap-3 pt-2">
                <Link href="/login" className="flex-1">
                  <button className="w-full px-4 py-2 text-[13px] font-medium text-[#2d7dd2] border border-[#2d7dd2] rounded-lg" onClick={() => setMobileOpen(false)}>
                    Se connecter
                  </button>
                </Link>
                <Link href="/tarifs" className="flex-1">
                  <button className="w-full px-4 py-2 text-[13px] font-medium text-white bg-[#2d7dd2] rounded-lg" onClick={() => setMobileOpen(false)}>
                    S'inscrire
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex flex-col items-start mb-3">
                <img src={ncvLogo} alt="NCV Mail" className="h-20 w-20 object-contain -mb-1" />
                <span className="font-semibold text-[15px] text-white">NCV Mail</span>
              </div>
              <p className="text-[13px] text-[#8b9cb3]">Une solution NCV Management</p>
            </div>

            <div>
              <h4 className="text-[13px] font-semibold text-white mb-3">Informations legales</h4>
              <div className="space-y-2">
                <Link href="/mentions-legales" className="block text-[13px] text-[#8b9cb3] hover:text-white transition-colors">
                  Mentions legales
                </Link>
                <Link href="/confidentialite" className="block text-[13px] text-[#8b9cb3] hover:text-white transition-colors">
                  Politique de confidentialite
                </Link>
                <Link href="/conditions" className="block text-[13px] text-[#8b9cb3] hover:text-white transition-colors">
                  Conditions d'utilisation
                </Link>
                <Link href="/login" className="block text-[13px] text-[#8b9cb3] hover:text-white transition-colors">
                  Acceder a mon compte
                </Link>
              </div>
            </div>

            <div>
              <h4 className="text-[13px] font-semibold text-white mb-3">Contact</h4>
              <a href="mailto:contact@ncvmail.com" className="text-[13px] text-[#8b9cb3] hover:text-white transition-colors">
                contact@ncvmail.com
              </a>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#1f2937] text-center">
            <p className="text-[12px] text-[#8b9cb3]">&copy; 2026 NCV Mail. Tous droits reserves.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
