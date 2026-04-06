import { MarketingLayout } from "@/components/layout/marketing-layout";

export default function Conditions() {
  return (
    <MarketingLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">Conditions d'utilisation</h1>

        <div className="space-y-8 text-[14px] text-[#8b9cb3] leading-relaxed">
          <div>
            <h2 className="text-[16px] font-semibold text-white mb-2">Editeur du service</h2>
            <p>Nom de l'entreprise : NCV Management SRL</p>
            <p>Siege social : Rixensart, Belgique</p>
            <p>Numero BCE : BE0439.327.747</p>
            <p>Email de contact : <a href="mailto:contact@ncvmail.com" className="text-[#2d7dd2] hover:underline">contact@ncvmail.com</a></p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">1. Description du service</h2>
            <p>NCV Mail est un service de tri et de gestion d'emails propulse par l'intelligence artificielle. Le service permet aux utilisateurs de connecter leurs boites de reception existantes afin d'automatiser le tri, la categorisation et la priorisation de leurs messages entrants.</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">2. Acces et creation de compte</h2>
            <p>L'acces au service necessite la creation d'un compte utilisateur. Lors de la creation de ce compte, l'utilisateur s'engage a fournir des informations exactes et a jour.</p>
            <p className="mt-2">L'utilisateur est seul responsable de la confidentialite de ses identifiants de connexion et de toutes les activites effectuees sous son compte. En cas d'utilisation non autorisee, l'utilisateur doit en informer immediatement NCV Management SRL.</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">3. Obligations de l'utilisateur</h2>
            <p className="mb-2">L'utilisateur s'engage a utiliser le service de maniere conforme aux lois en vigueur et aux presentes conditions.</p>
            <p className="mb-2">Il est strictement interdit de :</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Utiliser le service pour envoyer du spam ou des communications non sollicitees.</li>
              <li>Transmettre des contenus illegaux, diffamatoires, ou portant atteinte aux droits de tiers.</li>
              <li>Tenter de contourner les mesures de securite ou de perturber le fonctionnement du service.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">4. Limitation de responsabilite</h2>
            <p>NCV Management SRL s'efforce de maintenir le service accessible et operationnel, mais ne garantit pas un fonctionnement ininterrompu ou exempt d'erreurs.</p>
            <p className="mt-2">Dans les limites permises par la loi, NCV Management SRL decline toute responsabilite pour les dommages indirects, la perte de donnees, ou les pertes d'exploitation resultant de l'utilisation ou de l'impossibilite d'utiliser le service.</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">5. Propriete intellectuelle</h2>
            <p>Tous les elements composant le service NCV Mail (logiciels, interfaces, algorithmes, textes, images) sont la propriete exclusive de NCV Management SRL et sont proteges par les lois sur la propriete intellectuelle.</p>
            <p className="mt-2">L'utilisateur conserve l'entiere propriete des donnees et contenus (emails) qu'il soumet au service. Il accorde a NCV Management SRL une licence limitee au seul but de fournir le service de tri IA.</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">6. Resiliation du compte</h2>
            <p>L'utilisateur peut resilier son compte a tout moment depuis les parametres de son espace personnel.</p>
            <p className="mt-2">NCV Management SRL se reserve le droit de suspendre ou de resilier un compte en cas de violation des presentes conditions d'utilisation. A la resiliation, les donnees de l'utilisateur seront supprimees conformement a notre Politique de confidentialite.</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">7. Droit applicable et juridiction</h2>
            <p>Les presentes conditions d'utilisation sont regies par le droit belge. En cas de litige concernant l'interpretation ou l'execution de ces conditions, les tribunaux de Bruxelles seront seuls competents.</p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
