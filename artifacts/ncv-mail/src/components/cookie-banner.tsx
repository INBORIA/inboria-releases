import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Cookie, X } from "lucide-react";

const CONSENT_KEY = "inboria_cookie_consent";

type ConsentValue = "accepted" | "rejected" | "essential";

function getConsent(): ConsentValue | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "accepted" || v === "rejected" || v === "essential") return v;
    return null;
  } catch {
    return null;
  }
}

function setConsent(value: ConsentValue) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {}
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (getConsent() === null) {
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  if (!visible) return null;

  const accept = () => {
    setConsent("accepted");
    setVisible(false);
  };

  const acceptEssential = () => {
    setConsent("essential");
    setVisible(false);
  };

  const reject = () => {
    setConsent("rejected");
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 sm:p-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-2xl mx-auto bg-[#141c2b] border border-[#1f2937] rounded-xl shadow-2xl shadow-black/40">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2d7dd2]/15 flex items-center justify-center shrink-0 mt-0.5">
              <Cookie className="w-4.5 h-4.5 text-[#2d7dd2]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[14px] font-semibold text-white">Gestion des cookies</h3>
                <button onClick={reject} className="text-[#b8c5d6] hover:text-white transition-colors p-1 -m-1" aria-label="Fermer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[12px] text-[#b8c5d6] leading-relaxed mb-3">
                Inboria utilise des cookies pour assurer le bon fonctionnement du site et améliorer votre expérience.
                Vous pouvez accepter tous les cookies ou uniquement les cookies essentiels.{" "}
                <Link href="/confidentialite" className="text-[#2d7dd2] hover:underline">
                  En savoir plus
                </Link>
              </p>

              {showDetails && (
                <div className="mb-3 p-3 rounded-lg bg-[#0d1117] border border-[#1f2937] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-medium text-white">Cookies essentiels</p>
                      <p className="text-[11px] text-[#b8c5d6]">Authentification, session, sécurité</p>
                    </div>
                    <span className="text-[10px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">Toujours actifs</span>
                  </div>
                  <div className="border-t border-[#1f2937]" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-medium text-white">Cookies analytiques</p>
                      <p className="text-[11px] text-[#b8c5d6]">Statistiques d'utilisation anonymes</p>
                    </div>
                    <span className="text-[10px] font-medium text-[#b8c5d6] bg-white/5 px-2 py-0.5 rounded-full">Optionnels</span>
                  </div>
                  <div className="border-t border-[#1f2937]" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-medium text-white">Cookies de préférences</p>
                      <p className="text-[11px] text-[#b8c5d6]">Mémorisation de vos choix d'interface</p>
                    </div>
                    <span className="text-[10px] font-medium text-[#b8c5d6] bg-white/5 px-2 py-0.5 rounded-full">Optionnels</span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={accept}
                  className="px-4 py-2 text-[12px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors"
                >
                  Tout accepter
                </button>
                <button
                  onClick={acceptEssential}
                  className="px-4 py-2 text-[12px] font-semibold text-white bg-[#1f2937] rounded-lg hover:bg-[#2a3544] transition-colors"
                >
                  Essentiels uniquement
                </button>
                <button
                  onClick={reject}
                  className="px-4 py-2 text-[12px] font-semibold text-[#b8c5d6] hover:text-white transition-colors"
                >
                  Refuser
                </button>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="px-3 py-2 text-[11px] font-medium text-[#2d7dd2] hover:underline transition-colors ml-auto"
                >
                  {showDetails ? "Masquer les détails" : "Personnaliser"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function getCookieConsent(): ConsentValue | null {
  return getConsent();
}
