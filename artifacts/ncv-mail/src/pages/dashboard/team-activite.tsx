import { useEffect } from "react";
import { useLocation } from "wouter";

// Page legacy "Activité équipe" — remplacée par la vue Assignés intégrée
// au dashboard (onglet « Assignés » dans la barre des boîtes), qui a
// désormais la MÊME présentation que Partagées (header sticky + 2
// dropdowns Statut/Membre + EmailRow + hover/clic droit + sélection
// multiple). Ce composant ne fait plus qu'une redirection 1:1 vers
// `/dashboard?mode=assigned`. On garde le fichier (et la route dans
// App.tsx) pour ne pas casser les anciens liens / favoris.
export default function TeamActivitePage() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/dashboard?mode=assigned", { replace: true });
  }, [navigate]);
  return null;
}
