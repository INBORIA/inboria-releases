import { MarketingLayout } from "@/components/layout/marketing-layout";

export default function Conditions() {
  return (
    <MarketingLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">Conditions d'utilisation</h1>

        <div className="space-y-8 text-[14px] text-[#8b9cb3] leading-relaxed">
          <div>
            <h2 className="text-[16px] font-semibold text-white mb-2">Éditeur du service</h2>
            <p>Nom de l'entreprise : NCV Management SRL</p>
            <p>Siège social : Rixensart, Belgique</p>
            <p>Numéro BCE : BE0439.327.747</p>
            <p>Email de contact : <a href="mailto:contact@ncvmail.com" className="text-[#2d7dd2] hover:underline">contact@ncvmail.com</a></p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">1. Description du service</h2>
            <p>NCV Mail est un service de tri et de gestion d'emails propulsé par l'intelligence artificielle. Le service permet aux utilisateurs de connecter leurs boîtes de réception existantes afin d'automatiser le tri, la catégorisation et la priorisation de leurs messages entrants.</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">2. Accès et création de compte</h2>
            <p>L'accès au service nécessite la création d'un compte utilisateur. Lors de la création de ce compte, l'utilisateur s'engage à fournir des informations exactes et à jour.</p>
            <p className="mt-2">L'utilisateur est seul responsable de la confidentialité de ses identifiants de connexion et de toutes les activités effectuées sous son compte. En cas d'utilisation non autorisée, l'utilisateur doit en informer immédiatement NCV Management SRL.</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">3. Obligations de l'utilisateur</h2>
            <p className="mb-2">L'utilisateur s'engage à utiliser le service de manière conforme aux lois en vigueur et aux présentes conditions.</p>
            <p className="mb-2">Il est strictement interdit de :</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Utiliser le service pour envoyer du spam ou des communications non sollicitées.</li>
              <li>Transmettre des contenus illégaux, diffamatoires, ou portant atteinte aux droits de tiers.</li>
              <li>Tenter de contourner les mesures de sécurité ou de perturber le fonctionnement du service.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">4. Limitation de responsabilité</h2>
            <p>NCV Management SRL s'efforce de maintenir le service accessible et opérationnel, mais ne garantit pas un fonctionnement ininterrompu ou exempt d'erreurs.</p>
            <p className="mt-2">Dans les limites permises par la loi, NCV Management SRL décline toute responsabilité pour les dommages indirects, la perte de données, ou les pertes d'exploitation résultant de l'utilisation ou de l'impossibilité d'utiliser le service.</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">5. Propriété intellectuelle</h2>
            <p>Tous les éléments composant le service NCV Mail (logiciels, interfaces, algorithmes, textes, images) sont la propriété exclusive de NCV Management SRL et sont protégés par les lois sur la propriété intellectuelle.</p>
            <p className="mt-2">L'utilisateur conserve l'entière propriété des données et contenus (emails) qu'il soumet au service. Il accorde à NCV Management SRL une licence limitée au seul but de fournir le service de tri IA.</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">6. Résiliation du compte</h2>
            <p>L'utilisateur peut résilier son compte à tout moment depuis les paramètres de son espace personnel.</p>
            <p className="mt-2">NCV Management SRL se réserve le droit de suspendre ou de résilier un compte en cas de violation des présentes conditions d'utilisation. À la résiliation, les données de l'utilisateur seront supprimées conformément à notre Politique de confidentialité.</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">7. Droit applicable et juridiction</h2>
            <p>Les présentes conditions d'utilisation sont régies par le droit belge. En cas de litige concernant l'interprétation ou l'exécution de ces conditions, les tribunaux de Bruxelles seront seuls compétents.</p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
