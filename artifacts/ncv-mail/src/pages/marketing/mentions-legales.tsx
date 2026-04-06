import { MarketingLayout } from "@/components/layout/marketing-layout";

export default function MentionsLegales() {
  return (
    <MarketingLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">Mentions legales</h1>

        <div className="space-y-6 text-[14px] text-[#8b9cb3] leading-relaxed">
          <div>
            <h2 className="text-[16px] font-semibold text-white mb-2">Editeur du site</h2>
            <p>Nom de l'entreprise : NCV Management SRL</p>
            <p>Siege social : Rixensart, Belgique</p>
            <p>Numero BCE : BE0439.327.747</p>
            <p>Email de contact : <a href="mailto:contact@ncvmail.com" className="text-[#2d7dd2] hover:underline">contact@ncvmail.com</a></p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-2">Hebergeur</h2>
            <p>Fournisseur d'hebergement : Replit, Inc.</p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
