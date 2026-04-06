import { MarketingLayout } from "@/components/layout/marketing-layout";

export default function Confidentialite() {
  return (
    <MarketingLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">Politique de confidentialité</h1>

        <div className="space-y-8 text-[14px] text-[#8b9cb3] leading-relaxed">
          <div>
            <h2 className="text-[16px] font-semibold text-white mb-2">Responsable du traitement</h2>
            <p>Nom de l'entreprise : NCV Management SRL</p>
            <p>Siège social : Rixensart, Belgique</p>
            <p>Numéro d'entreprise BCE : BE0439.327.747</p>
            <p>Email de contact : <a href="mailto:contact@ncvmail.com" className="text-[#2d7dd2] hover:underline">contact@ncvmail.com</a></p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">1. Données collectées</h2>
            <p className="mb-2">Dans le cadre de l'utilisation de nos services, nous sommes amenés à collecter les données suivantes :</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Adresse email</li>
              <li>Nom et prénom</li>
              <li>Données de connexion et d'authentification</li>
              <li>Contenu des emails traités par notre service d'intelligence artificielle</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">2. Utilisation des données</h2>
            <p className="mb-2">Vos données personnelles sont utilisées exclusivement pour les finalités suivantes :</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Fonctionnement du service de tri et d'analyse par IA</li>
              <li>Facturation et gestion de votre abonnement</li>
              <li>Amélioration continue de notre service et de nos algorithmes</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">3. Durée de conservation</h2>
            <p>Vos données restent actives et sont conservées tant que votre compte existe sur notre plateforme.</p>
            <p className="mt-2">Toutes vos données personnelles et le contenu de vos emails sont définitivement supprimés 30 jours après la résiliation de votre compte.</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">4. Vos droits (RGPD)</h2>
            <p className="mb-2">Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants concernant vos données personnelles :</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-white">Droit d'accès :</strong> Vous pouvez demander à consulter les données que nous possédons sur vous.</li>
              <li><strong className="text-white">Droit de rectification :</strong> Vous pouvez demander la correction de données inexactes.</li>
              <li><strong className="text-white">Droit à l'oubli (suppression) :</strong> Vous pouvez exiger l'effacement de vos données personnelles.</li>
              <li><strong className="text-white">Droit à la portabilité :</strong> Vous pouvez récupérer vos données dans un format structuré et lisible.</li>
            </ul>
            <p className="mt-3">Pour exercer ces droits, veuillez nous contacter à l'adresse : <a href="mailto:contact@ncvmail.com" className="text-[#2d7dd2] hover:underline">contact@ncvmail.com</a></p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
