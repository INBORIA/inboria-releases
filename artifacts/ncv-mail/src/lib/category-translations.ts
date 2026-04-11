type Translation = { en: string; nl: string; de: string; es: string };

const CATEGORY_MAP: Record<string, { name: Translation; desc: Translation }> = {
  "facturation": {
    name: { en: "Billing", nl: "Facturatie", de: "Rechnungsstellung", es: "Facturación" },
    desc: { en: "Invoices, quotes, purchase orders, payment reminders", nl: "Facturen, offertes, inkooporders, betalingsherinneringen", de: "Rechnungen, Angebote, Bestellungen, Zahlungserinnerungen", es: "Facturas, presupuestos, órdenes de compra, recordatorios de pago" },
  },
  "support client": {
    name: { en: "Customer Support", nl: "Klantenservice", de: "Kundensupport", es: "Soporte al cliente" },
    desc: { en: "Help requests, complaints, customer questions", nl: "Hulpverzoeken, klachten, klantenvragen", de: "Hilfeanfragen, Beschwerden, Kundenfragen", es: "Solicitudes de ayuda, reclamaciones, preguntas de clientes" },
  },
  "commercial": {
    name: { en: "Sales", nl: "Commercieel", de: "Vertrieb", es: "Comercial" },
    desc: { en: "Prospects, sales proposals, negotiations, deals", nl: "Prospects, commerciële voorstellen, onderhandelingen, verkoop", de: "Interessenten, Verkaufsangebote, Verhandlungen, Geschäfte", es: "Prospectos, propuestas comerciales, negociaciones, ventas" },
  },
  "administratif": {
    name: { en: "Administrative", nl: "Administratief", de: "Verwaltung", es: "Administrativo" },
    desc: { en: "Contracts, official documents, legal correspondence", nl: "Contracten, officiële documenten, juridische correspondentie", de: "Verträge, offizielle Dokumente, rechtliche Korrespondenz", es: "Contratos, documentos oficiales, correspondencia jurídica" },
  },
  "newsletter": {
    name: { en: "Newsletter", nl: "Nieuwsbrief", de: "Newsletter", es: "Boletín" },
    desc: { en: "Newsletters, informational emails", nl: "Nieuwsbrieven, informatieve e-mails", de: "Newsletter, Informations-E-Mails", es: "Boletines, correos informativos" },
  },
  "newsletter / marketing": {
    name: { en: "Newsletter / Marketing", nl: "Nieuwsbrief / Marketing", de: "Newsletter / Marketing", es: "Boletín / Marketing" },
    desc: { en: "Newsletters, promotions, marketing campaigns, advertisements", nl: "Nieuwsbrieven, promoties, marketingcampagnes, advertenties", de: "Newsletter, Werbeaktionen, Marketingkampagnen, Werbung", es: "Boletines, promociones, campañas de marketing, publicidad" },
  },
  "newsletters": {
    name: { en: "Newsletters", nl: "Nieuwsbrieven", de: "Newsletter", es: "Boletines" },
    desc: { en: "Newsletters, informational emails", nl: "Nieuwsbrieven, informatieve e-mails", de: "Newsletter, Informations-E-Mails", es: "Boletines, correos informativos" },
  },
  "rh / équipe": {
    name: { en: "HR / Team", nl: "HR / Team", de: "Personal / Team", es: "RRHH / Equipo" },
    desc: { en: "Leave, recruitment, personnel management, internal notes", nl: "Verlof, werving, personeelsbeheer, interne notities", de: "Urlaub, Rekrutierung, Personalverwaltung, interne Notizen", es: "Vacaciones, reclutamiento, gestión de personal, notas internas" },
  },
  "rh / equipe": {
    name: { en: "HR / Team", nl: "HR / Team", de: "Personal / Team", es: "RRHH / Equipo" },
    desc: { en: "Leave, recruitment, personnel management, internal notes", nl: "Verlof, werving, personeelsbeheer, interne notities", de: "Urlaub, Rekrutierung, Personalverwaltung, interne Notizen", es: "Vacaciones, reclutamiento, gestión de personal, notas internas" },
  },
  "fournisseurs": {
    name: { en: "Suppliers", nl: "Leveranciers", de: "Lieferanten", es: "Proveedores" },
    desc: { en: "Orders, deliveries, supplier relationships, purchases", nl: "Bestellingen, leveringen, leveranciersrelaties, aankopen", de: "Bestellungen, Lieferungen, Lieferantenbeziehungen, Einkäufe", es: "Pedidos, entregas, relaciones con proveedores, compras" },
  },
  "juridique": {
    name: { en: "Legal", nl: "Juridisch", de: "Recht", es: "Jurídico" },
    desc: { en: "Legal notices, contracts, compliance", nl: "Juridische mededelingen, contracten, compliance", de: "Rechtliche Hinweise, Verträge, Compliance", es: "Avisos legales, contratos, cumplimiento normativo" },
  },
  "juridique / conformité": {
    name: { en: "Legal / Compliance", nl: "Juridisch / Compliance", de: "Recht / Compliance", es: "Jurídico / Cumplimiento" },
    desc: { en: "Formal notices, GDPR, compliance, disputes, contracts", nl: "Ingebrekestellingen, AVG, compliance, geschillen, contracten", de: "Abmahnungen, DSGVO, Compliance, Rechtsstreitigkeiten, Verträge", es: "Requerimientos, RGPD, cumplimiento, litigios, contratos" },
  },
  "juridique / conformite": {
    name: { en: "Legal / Compliance", nl: "Juridisch / Compliance", de: "Recht / Compliance", es: "Jurídico / Cumplimiento" },
    desc: { en: "Formal notices, GDPR, compliance, disputes, contracts", nl: "Ingebrekestellingen, AVG, compliance, geschillen, contracten", de: "Abmahnungen, DSGVO, Compliance, Rechtsstreitigkeiten, Verträge", es: "Requerimientos, RGPD, cumplimiento, litigios, contratos" },
  },
  "technique": {
    name: { en: "Technical", nl: "Technisch", de: "Technik", es: "Técnico" },
    desc: { en: "Bugs, maintenance, servers, IT, technical requests", nl: "Bugs, onderhoud, servers, IT, technische verzoeken", de: "Bugs, Wartung, Server, IT, technische Anfragen", es: "Errores, mantenimiento, servidores, IT, solicitudes técnicas" },
  },
  "technique / it": {
    name: { en: "Technical / IT", nl: "Technisch / IT", de: "Technik / IT", es: "Técnico / IT" },
    desc: { en: "Bugs, maintenance, servers, IT, technical requests", nl: "Bugs, onderhoud, servers, IT, technische verzoeken", de: "Bugs, Wartung, Server, IT, technische Anfragen", es: "Errores, mantenimiento, servidores, IT, solicitudes técnicas" },
  },
  "formation": {
    name: { en: "Training", nl: "Opleiding", de: "Weiterbildung", es: "Formación" },
    desc: { en: "Webinars, certifications, e-learning, invitations", nl: "Webinars, certificeringen, e-learning, uitnodigingen", de: "Webinare, Zertifizierungen, E-Learning, Einladungen", es: "Seminarios web, certificaciones, e-learning, invitaciones" },
  },
  "banque / finance": {
    name: { en: "Banking / Finance", nl: "Bank / Financiën", de: "Bank / Finanzen", es: "Banca / Finanzas" },
    desc: { en: "Bank statements, transfers, loans, insurance", nl: "Bankafschriften, overschrijvingen, leningen, verzekeringen", de: "Kontoauszüge, Überweisungen, Kredite, Versicherungen", es: "Extractos bancarios, transferencias, préstamos, seguros" },
  },
  "banque": {
    name: { en: "Banking", nl: "Bank", de: "Bank", es: "Banca" },
    desc: { en: "Bank statements, transfers, loans", nl: "Bankafschriften, overschrijvingen, leningen", de: "Kontoauszüge, Überweisungen, Kredite", es: "Extractos bancarios, transferencias, préstamos" },
  },
  "logistique / livraisons": {
    name: { en: "Logistics / Deliveries", nl: "Logistiek / Leveringen", de: "Logistik / Lieferungen", es: "Logística / Entregas" },
    desc: { en: "Package tracking, carriers, delivery notes", nl: "Pakkettracking, vervoerders, leveringsbonnen", de: "Paketverfolgung, Spediteure, Lieferscheine", es: "Seguimiento de paquetes, transportistas, albaranes" },
  },
  "rendez-vous / planning": {
    name: { en: "Appointments / Planning", nl: "Afspraken / Planning", de: "Termine / Planung", es: "Citas / Planificación" },
    desc: { en: "Confirmations, cancellations, meeting reminders", nl: "Bevestigingen, annuleringen, vergaderherinneringen", de: "Bestätigungen, Absagen, Besprechungserinnerungen", es: "Confirmaciones, cancelaciones, recordatorios de reuniones" },
  },
  "international / export": {
    name: { en: "International / Export", nl: "Internationaal / Export", de: "International / Export", es: "Internacional / Exportación" },
    desc: { en: "Customs, foreign clients, translations, incoterms", nl: "Douane, buitenlandse klanten, vertalingen, incoterms", de: "Zoll, ausländische Kunden, Übersetzungen, Incoterms", es: "Aduanas, clientes extranjeros, traducciones, incoterms" },
  },
  "urgent / prioritaire": {
    name: { en: "Urgent / Priority", nl: "Urgent / Prioriteit", de: "Dringend / Priorität", es: "Urgente / Prioritario" },
    desc: { en: "Emails requiring immediate action, critical alerts", nl: "E-mails die onmiddellijke actie vereisen, kritieke meldingen", de: "E-Mails, die sofortiges Handeln erfordern, kritische Warnungen", es: "Correos que requieren acción inmediata, alertas críticas" },
  },
  "comptabilité": {
    name: { en: "Accounting", nl: "Boekhouding", de: "Buchhaltung", es: "Contabilidad" },
    desc: { en: "Accounting entries, balance sheets, VAT, tax returns", nl: "Boekingen, jaarrekeningen, BTW, belastingaangiften", de: "Buchungen, Bilanzen, MwSt., Steuererklärungen", es: "Asientos contables, balances, IVA, declaraciones fiscales" },
  },
  "comptabilite": {
    name: { en: "Accounting", nl: "Boekhouding", de: "Buchhaltung", es: "Contabilidad" },
    desc: { en: "Accounting entries, balance sheets, VAT, tax returns", nl: "Boekingen, jaarrekeningen, BTW, belastingaangiften", de: "Buchungen, Bilanzen, MwSt., Steuererklärungen", es: "Asientos contables, balances, IVA, declaraciones fiscales" },
  },
  "paiements / encaissements": {
    name: { en: "Payments / Collections", nl: "Betalingen / Incasso's", de: "Zahlungen / Inkasso", es: "Pagos / Cobros" },
    desc: { en: "Payment confirmations, delays, reminders, refunds", nl: "Betalingsbevestigingen, vertragingen, herinneringen, terugbetalingen", de: "Zahlungsbestätigungen, Verzögerungen, Mahnungen, Erstattungen", es: "Confirmaciones de pago, retrasos, recordatorios, reembolsos" },
  },
  "partenaires / sous-traitants": {
    name: { en: "Partners / Subcontractors", nl: "Partners / Onderaannemers", de: "Partner / Subunternehmer", es: "Socios / Subcontratistas" },
    desc: { en: "Collaborations, agreements, exchanges with external partners", nl: "Samenwerkingen, overeenkomsten, uitwisselingen met externe partners", de: "Kooperationen, Vereinbarungen, Austausch mit externen Partnern", es: "Colaboraciones, acuerdos, intercambios con socios externos" },
  },
  "projets": {
    name: { en: "Projects", nl: "Projecten", de: "Projekte", es: "Proyectos" },
    desc: { en: "Project tracking, deliverables, deadlines, progress reports", nl: "Projectopvolging, deliverables, deadlines, voortgangsrapporten", de: "Projektverfolgung, Ergebnisse, Fristen, Fortschrittsberichte", es: "Seguimiento de proyectos, entregables, plazos, informes de progreso" },
  },
  "communication interne": {
    name: { en: "Internal Communication", nl: "Interne Communicatie", de: "Interne Kommunikation", es: "Comunicación interna" },
    desc: { en: "Memos, announcements, minutes, circulars", nl: "Memo's, aankondigingen, notulen, circulaires", de: "Memos, Ankündigungen, Protokolle, Rundschreiben", es: "Memorandos, anuncios, actas, circulares" },
  },
  "immobilier / locaux": {
    name: { en: "Real Estate / Premises", nl: "Vastgoed / Kantoren", de: "Immobilien / Räumlichkeiten", es: "Inmuebles / Locales" },
    desc: { en: "Leases, rents, building maintenance, charges", nl: "Huurcontracten, huur, gebouwonderhoud, lasten", de: "Mietverträge, Mieten, Gebäudewartung, Nebenkosten", es: "Arrendamientos, alquileres, mantenimiento de edificios, cargas" },
  },
  "abonnements / saas": {
    name: { en: "Subscriptions / SaaS", nl: "Abonnementen / SaaS", de: "Abonnements / SaaS", es: "Suscripciones / SaaS" },
    desc: { en: "Software licenses, renewals, tool invoices", nl: "Softwarelicenties, verlengingen, facturen voor tools", de: "Softwarelizenzen, Verlängerungen, Tool-Rechnungen", es: "Licencias de software, renovaciones, facturas de herramientas" },
  },
  "devis / négociations": {
    name: { en: "Quotes / Negotiations", nl: "Offertes / Onderhandelingen", de: "Angebote / Verhandlungen", es: "Presupuestos / Negociaciones" },
    desc: { en: "Quote requests, comparisons, counter-proposals", nl: "Offerteaanvragen, vergelijkingen, tegenvoorstellen", de: "Angebotsanfragen, Vergleiche, Gegenangebote", es: "Solicitudes de presupuesto, comparativas, contrapropuestas" },
  },
  "devis / negociations": {
    name: { en: "Quotes / Negotiations", nl: "Offertes / Onderhandelingen", de: "Angebote / Verhandlungen", es: "Presupuestos / Negociaciones" },
    desc: { en: "Quote requests, comparisons, counter-proposals", nl: "Offerteaanvragen, vergelijkingen, tegenvoorstellen", de: "Angebotsanfragen, Vergleiche, Gegenangebote", es: "Solicitudes de presupuesto, comparativas, contrapropuestas" },
  },
  "spam / à supprimer": {
    name: { en: "Spam / To Delete", nl: "Spam / Te Verwijderen", de: "Spam / Zu löschen", es: "Spam / A eliminar" },
    desc: { en: "Unwanted emails, unsolicited solicitations", nl: "Ongewenste e-mails, ongevraagde reclame", de: "Unerwünschte E-Mails, unaufgeforderte Werbung", es: "Correos no deseados, solicitudes no solicitadas" },
  },
  "spam / a supprimer": {
    name: { en: "Spam / To Delete", nl: "Spam / Te Verwijderen", de: "Spam / Zu löschen", es: "Spam / A eliminar" },
    desc: { en: "Unwanted emails, unsolicited solicitations", nl: "Ongewenste e-mails, ongevraagde reclame", de: "Unerwünschte E-Mails, unaufgeforderte Werbung", es: "Correos no deseados, solicitudes no solicitadas" },
  },
  "non classé": {
    name: { en: "Uncategorized", nl: "Niet geclassificeerd", de: "Nicht klassifiziert", es: "Sin clasificar" },
    desc: { en: "Emails not assigned to any category", nl: "E-mails die niet aan een categorie zijn toegewezen", de: "E-Mails, die keiner Kategorie zugeordnet sind", es: "Correos no asignados a ninguna categoría" },
  },
  "non classe": {
    name: { en: "Uncategorized", nl: "Niet geclassificeerd", de: "Nicht klassifiziert", es: "Sin clasificar" },
    desc: { en: "Emails not assigned to any category", nl: "E-mails die niet aan een categorie zijn toegewezen", de: "E-Mails, die keiner Kategorie zugeordnet sind", es: "Correos no asignados a ninguna categoría" },
  },
  "promotions": {
    name: { en: "Promotions", nl: "Promoties", de: "Aktionen", es: "Promociones" },
    desc: { en: "Promotional offers, discounts, special deals", nl: "Promotionele aanbiedingen, kortingen, speciale deals", de: "Werbeaktionen, Rabatte, Sonderangebote", es: "Ofertas promocionales, descuentos, ofertas especiales" },
  },
  "promotion": {
    name: { en: "Promotion", nl: "Promotie", de: "Aktion", es: "Promoción" },
    desc: { en: "Promotional offers, discounts, special deals", nl: "Promotionele aanbiedingen, kortingen, speciale deals", de: "Werbeaktionen, Rabatte, Sonderangebote", es: "Ofertas promocionales, descuentos, ofertas especiales" },
  },
  "notifications": {
    name: { en: "Notifications", nl: "Meldingen", de: "Benachrichtigungen", es: "Notificaciones" },
    desc: { en: "Automated notifications, system alerts", nl: "Automatische meldingen, systeemwaarschuwingen", de: "Automatische Benachrichtigungen, Systemwarnungen", es: "Notificaciones automáticas, alertas del sistema" },
  },
  "reseaux sociaux": {
    name: { en: "Social Media", nl: "Sociale Media", de: "Soziale Medien", es: "Redes sociales" },
    desc: { en: "Social media notifications and messages", nl: "Sociale media-meldingen en berichten", de: "Social-Media-Benachrichtigungen und Nachrichten", es: "Notificaciones y mensajes de redes sociales" },
  },
  "réseaux sociaux": {
    name: { en: "Social Media", nl: "Sociale Media", de: "Soziale Medien", es: "Redes sociales" },
    desc: { en: "Social media notifications and messages", nl: "Sociale media-meldingen en berichten", de: "Social-Media-Benachrichtigungen und Nachrichten", es: "Notificaciones y mensajes de redes sociales" },
  },
  "hebergement": {
    name: { en: "Hosting", nl: "Hosting", de: "Hosting", es: "Alojamiento" },
    desc: { en: "Web hosting, servers, domains", nl: "Webhosting, servers, domeinen", de: "Webhosting, Server, Domains", es: "Alojamiento web, servidores, dominios" },
  },
  "hébergement": {
    name: { en: "Hosting", nl: "Hosting", de: "Hosting", es: "Alojamiento" },
    desc: { en: "Web hosting, servers, domains", nl: "Webhosting, servers, domeinen", de: "Webhosting, Server, Domains", es: "Alojamiento web, servidores, dominios" },
  },
  "finance": {
    name: { en: "Finance", nl: "Financiën", de: "Finanzen", es: "Finanzas" },
    desc: { en: "Financial operations, investments, budgets", nl: "Financiële operaties, investeringen, budgetten", de: "Finanzoperationen, Investitionen, Budgets", es: "Operaciones financieras, inversiones, presupuestos" },
  },
  "clients": {
    name: { en: "Clients", nl: "Klanten", de: "Kunden", es: "Clientes" },
    desc: { en: "Client communications, requests, follow-ups", nl: "Klantcommunicatie, verzoeken, opvolging", de: "Kundenkommunikation, Anfragen, Nachverfolgung", es: "Comunicación con clientes, solicitudes, seguimiento" },
  },
  "rh": {
    name: { en: "HR", nl: "HR", de: "Personal", es: "RRHH" },
    desc: { en: "Human resources, recruitment, personnel", nl: "Human resources, werving, personeel", de: "Personalwesen, Rekrutierung, Personal", es: "Recursos humanos, reclutamiento, personal" },
  },
  "marketing": {
    name: { en: "Marketing", nl: "Marketing", de: "Marketing", es: "Marketing" },
    desc: { en: "Marketing campaigns, communications, branding", nl: "Marketingcampagnes, communicatie, branding", de: "Marketingkampagnen, Kommunikation, Branding", es: "Campañas de marketing, comunicación, branding" },
  },
  "declarations fiscales": {
    name: { en: "Tax Returns", nl: "Belastingaangiften", de: "Steuererklärungen", es: "Declaraciones fiscales" },
    desc: { en: "Tax filings, declarations, fiscal documents", nl: "Belastingaangiften, verklaringen, fiscale documenten", de: "Steuererklärungen, Meldungen, Steuerdokumente", es: "Declaraciones fiscales, documentos tributarios" },
  },
  "facturation clients": {
    name: { en: "Client Billing", nl: "Klantfacturatie", de: "Kundenabrechnung", es: "Facturación clientes" },
    desc: { en: "Client invoices, billing, payments", nl: "Klantfacturen, facturatie, betalingen", de: "Kundenrechnungen, Abrechnung, Zahlungen", es: "Facturas de clientes, facturación, pagos" },
  },
  "social / paie": {
    name: { en: "Payroll / Social", nl: "Loonbeheer / Sociaal", de: "Lohnabrechnung / Soziales", es: "Nóminas / Social" },
    desc: { en: "Payroll, social contributions, pay slips", nl: "Loonbeheer, sociale bijdragen, loonstrookjes", de: "Gehaltsabrechnung, Sozialabgaben, Lohnzettel", es: "Nóminas, cotizaciones sociales, recibos de sueldo" },
  },
  "dossiers clients": {
    name: { en: "Client Files", nl: "Klantendossiers", de: "Kundenakten", es: "Expedientes de clientes" },
    desc: { en: "Client files, case management", nl: "Klantendossiers, dossierbeheer", de: "Kundenakten, Fallverwaltung", es: "Expedientes de clientes, gestión de casos" },
  },
  "tribunaux": {
    name: { en: "Courts", nl: "Rechtbanken", de: "Gerichte", es: "Tribunales" },
    desc: { en: "Court proceedings, judgments, summons", nl: "Rechtszaken, vonnissen, dagvaardingen", de: "Gerichtsverfahren, Urteile, Vorladungen", es: "Procedimientos judiciales, sentencias, citaciones" },
  },
  "confreres": {
    name: { en: "Colleagues", nl: "Collega's", de: "Kollegen", es: "Colegas" },
    desc: { en: "Professional peer communications", nl: "Professionele communicatie met collega's", de: "Professionelle Kommunikation mit Kollegen", es: "Comunicación con colegas profesionales" },
  },
  "huissiers / experts": {
    name: { en: "Bailiffs / Experts", nl: "Deurwaarders / Experts", de: "Gerichtsvollzieher / Gutachter", es: "Alguaciles / Peritos" },
    desc: { en: "Bailiff notices, expert reports, assessments", nl: "Deurwaardersberichten, expertiserapporten, beoordelingen", de: "Gerichtsvollzieherberichte, Gutachten, Bewertungen", es: "Notificaciones judiciales, informes periciales, evaluaciones" },
  },
  "actes immobiliers": {
    name: { en: "Property Deeds", nl: "Onroerendgoedakten", de: "Immobilienurkunden", es: "Escrituras inmobiliarias" },
    desc: { en: "Property deeds, real estate transactions", nl: "Eigendomsakten, vastgoedtransacties", de: "Eigentumsurkunden, Immobilientransaktionen", es: "Escrituras de propiedad, transacciones inmobiliarias" },
  },
  "successions": {
    name: { en: "Inheritances", nl: "Erfenissen", de: "Erbschaften", es: "Sucesiones" },
    desc: { en: "Inheritances, estate planning, wills", nl: "Erfenissen, nalatenschapsplanning, testamenten", de: "Erbschaften, Nachlassplanung, Testamente", es: "Herencias, planificación patrimonial, testamentos" },
  },
  "droit familial": {
    name: { en: "Family Law", nl: "Familierecht", de: "Familienrecht", es: "Derecho de familia" },
    desc: { en: "Family law, divorce, custody", nl: "Familierecht, echtscheiding, voogdij", de: "Familienrecht, Scheidung, Sorgerecht", es: "Derecho de familia, divorcio, custodia" },
  },
  "societes": {
    name: { en: "Companies", nl: "Vennootschappen", de: "Unternehmen", es: "Empresas" },
    desc: { en: "Company law, incorporation, corporate matters", nl: "Vennootschapsrecht, oprichting, bedrijfszaken", de: "Gesellschaftsrecht, Gründung, Unternehmensangelegenheiten", es: "Derecho de sociedades, constitución, asuntos corporativos" },
  },
  "administration": {
    name: { en: "Administration", nl: "Administratie", de: "Verwaltung", es: "Administración" },
    desc: { en: "Administrative tasks, office management", nl: "Administratieve taken, kantoorbeheer", de: "Verwaltungsaufgaben, Büromanagement", es: "Tareas administrativas, gestión de oficina" },
  },
};

function getLangValue(t: Translation, lang: string): string {
  if (lang === "nl") return t.nl;
  if (lang === "de") return t.de;
  if (lang === "es") return t.es;
  return t.en;
}

export function translateCategoryName(name: string, lang: string): string {
  if (lang === "fr") return name;
  const key = name.toLowerCase().trim();
  const entry = CATEGORY_MAP[key];
  if (!entry) return name;
  return getLangValue(entry.name, lang);
}

export function translateCategoryDescription(description: string, lang: string): string {
  if (lang === "fr" || !description) return description;
  for (const entry of Object.values(CATEGORY_MAP)) {
    if (entry.desc.en === description || isMatchingFrDesc(description, entry)) {
      return getLangValue(entry.desc, lang);
    }
  }
  return description;
}

export function translateCategory(name: string, description: string | undefined | null, lang: string): { name: string; description: string } {
  if (lang === "fr") return { name, description: description || "" };
  const key = name.toLowerCase().trim();
  const entry = CATEGORY_MAP[key];
  if (!entry) return { name, description: description || "" };
  return {
    name: getLangValue(entry.name, lang),
    description: description ? getLangValue(entry.desc, lang) : "",
  };
}

const FR_DESC_MAP: Record<string, string> = {
  "factures, devis, bons de commande, relances de paiement": "facturation",
  "demandes d'aide, réclamations, questions des clients": "support client",
  "prospects, propositions commerciales, négociations, ventes": "commercial",
  "contrats, documents officiels, courriers juridiques": "administratif",
  "congés, recrutement, gestion du personnel, notes internes": "rh / équipe",
  "commandes, livraisons, relations fournisseurs, achats": "fournisseurs",
  "mises en demeure, rgpd, conformité, contentieux, contrats": "juridique / conformité",
  "bugs, maintenance, serveurs, it, demandes techniques": "technique / it",
  "webinaires, certifications, e-learning, invitations": "formation",
  "relevés bancaires, virements, prêts, assurances": "banque / finance",
  "suivi de colis, transporteurs, bons de livraison": "logistique / livraisons",
  "confirmations, annulations, rappels de réunions": "rendez-vous / planning",
  "douanes, clients étrangers, traductions, incoterms": "international / export",
  "emails nécessitant une action immédiate, alertes critiques": "urgent / prioritaire",
  "écritures comptables, bilans, tva, déclarations fiscales": "comptabilité",
  "confirmations de paiement, retards, rappels, remboursements": "paiements / encaissements",
  "collaborations, accords, échanges avec partenaires externes": "partenaires / sous-traitants",
  "suivi de projet, livrables, deadlines, rapports d'avancement": "projets",
  "mémos, annonces, comptes-rendus, circulaires": "communication interne",
  "baux, loyers, maintenance bâtiment, charges": "immobilier / locaux",
  "licences logiciels, renouvellements, factures outils": "abonnements / saas",
  "demandes de devis, comparatifs, contre-propositions": "devis / négociations",
  "emails indésirables, démarchage non sollicité": "spam / à supprimer",
  "newsletters, promotions, campagnes marketing, publicités": "newsletter / marketing",
};

function isMatchingFrDesc(description: string, entry: { desc: Translation }): boolean {
  const descLower = description.toLowerCase().trim();
  const catKey = FR_DESC_MAP[descLower];
  if (!catKey) return false;
  const mapEntry = CATEGORY_MAP[catKey];
  return mapEntry === Object.values(CATEGORY_MAP).find(e => e === entry);
}
