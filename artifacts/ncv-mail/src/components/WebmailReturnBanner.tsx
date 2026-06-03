import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, X } from "lucide-react";

const FLAG_KEY = "inboria.fromExtension";

/**
 * Bandeau affiché quand Inboria est ouvert depuis l'extension navigateur
 * « Demander à Inboria » (URL ...?from=extension), depuis n'importe quel
 * webmail (OVH/Roundcube, Yahoo, GMX, Zoho, iCloud…). Permet de revenir au
 * webmail en fermant l'onglet Inboria (l'onglet du webmail reste ouvert
 * derrière). Contrairement à Gmail, les webmails génériques n'ont pas de
 * lien profond vers un mail précis : on se contente donc de redonner le focus
 * à l'onglet d'origine.
 * L'état est mémorisé en sessionStorage car le paramètre d'URL est retiré dès
 * le montage (et la navigation interne ferait sinon disparaître le bandeau).
 */
export function WebmailReturnBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const fromExtension = url.searchParams.get("from") === "extension";
      if (fromExtension) {
        window.sessionStorage.setItem(FLAG_KEY, "1");
        url.searchParams.delete("from");
        window.history.replaceState(
          {},
          "",
          url.pathname + (url.search ? url.search : ""),
        );
      }
      if (window.sessionStorage.getItem(FLAG_KEY) === "1") {
        setVisible(true);
      }
    } catch {
      /* noop */
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.sessionStorage.removeItem(FLAG_KEY);
    } catch {
      /* noop */
    }
    setVisible(false);
  };

  const backToWebmail = () => {
    // L'onglet Inboria a été ouvert par l'extension : on le ferme pour rendre
    // le focus à l'onglet du webmail resté ouvert derrière.
    try {
      window.sessionStorage.removeItem(FLAG_KEY);
    } catch {
      /* noop */
    }
    window.close();
    // Si le navigateur refuse de fermer l'onglet (non ouvert par script),
    // on masque au moins le bandeau et on laisse l'utilisateur basculer.
    setVisible(false);
  };

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-5 py-2">
      <div className="flex items-center gap-3 max-w-4xl mx-auto">
        <ArrowLeft className="w-4 h-4 text-primary shrink-0" />
        <p className="flex-1 text-[12px] text-[#b8c5d6]">
          {t(
            "webmailBanner.openedFrom",
            "Ouvert depuis votre webmail. Cliquez pour revenir, ou rebasculez simplement sur l'onglet de votre webmail.",
          )}
        </p>
        <button
          type="button"
          onClick={backToWebmail}
          className="shrink-0 h-7 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("webmailBanner.back", "Revenir à mon webmail")}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("common.dismiss", "Fermer")}
          className="shrink-0 text-[#8b95a7] hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
