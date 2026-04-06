import { MarketingLayout } from "@/components/layout/marketing-layout";

export default function Confidentialite() {
  return (
    <MarketingLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">Politique de confidentialite</h1>

        <div className="space-y-8 text-[14px] text-[#8b9cb3] leading-relaxed">
          <div>
            <h2 className="text-[16px] font-semibold text-white mb-2">Responsable du traitement</h2>
            <p>Nom de l'entreprise : NCV Management SRL</p>
            <p>Siege social : Rixensart, Belgique</p>
            <p>Numero d'entreprise BCE : BE0439.327.747</p>
            <p>Email de contact : <a href="mailto:contact@ncvmail.com" className="text-[#2d7dd2] hover:underline">contact@ncvmail.com</a></p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">1. Donnees collectees</h2>
            <p className="mb-2">Dans le cadre de l'utilisation de nos services, nous sommes amenes a collecter les donnees suivantes :</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Adresse email</li>
              <li>Nom et prenom</li>
              <li>Donnees de connexion et d'authentification</li>
              <li>Contenu des emails traites par notre service d'intelligence artificielle</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">2. Utilisation des donnees</h2>
            <p className="mb-2">Vos donnees personnelles sont utilisees exclusivement pour les finalites suivantes :</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Fonctionnement du service de tri et d'analyse par IA</li>
              <li>Facturation et gestion de votre abonnement</li>
              <li>Amelioration continue de notre service et de nos algorithmes</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">3. Duree de conservation</h2>
            <p>Vos donnees restent actives et sont conservees tant que votre compte existe sur notre plateforme.</p>
            <p className="mt-2">Toutes vos donnees personnelles et le contenu de vos emails sont definitivement supprimes 30 jours apres la resiliation de votre compte.</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">4. Vos droits (RGPD)</h2>
            <p className="mb-2">Conformement au Reglement General sur la Protection des Donnees (RGPD), vous disposez des droits suivants concernant vos donnees personnelles :</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-white">Droit d'acces :</strong> Vous pouvez demander a consulter les donnees que nous possedons sur vous.</li>
              <li><strong className="text-white">Droit de rectification :</strong> Vous pouvez demander la correction de donnees inexactes.</li>
              <li><strong className="text-white">Droit a l'oubli (suppression) :</strong> Vous pouvez exiger l'effacement de vos donnees personnelles.</li>
              <li><strong className="text-white">Droit a la portabilite :</strong> Vous pouvez recuperer vos donnees dans un format structure et lisible.</li>
            </ul>
            <p className="mt-3">Pour exercer ces droits, veuillez nous contacter a l'adresse : <a href="mailto:contact@ncvmail.com" className="text-[#2d7dd2] hover:underline">contact@ncvmail.com</a></p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
