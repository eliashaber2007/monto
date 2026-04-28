import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <h1 className="text-2xl font-bold mb-1">Politique de Confidentialité — Monto</h1>
        <p className="text-sm text-muted-foreground mb-8">Dernière mise à jour : 28 avril 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Introduction</h2>
            <p>
              Fortis Invest (ci-après « nous », « notre », « nos ») exploite l'application mobile et web
              Monto - Money Pots (ci-après « l'Application »). La présente Politique de Confidentialité décrit
              comment nous collectons, utilisons, stockons et protégeons vos données personnelles lorsque vous
              utilisez notre Application.
            </p>
            <p className="mt-2">
              En utilisant Monto, vous acceptez les pratiques décrites dans la présente politique. Si vous
              n'acceptez pas ces conditions, veuillez ne pas utiliser l'Application.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Responsable du Traitement</h2>
            <p>Le responsable du traitement de vos données personnelles est :</p>
            <p className="mt-2">
              <span className="text-foreground font-medium">Fortis Invest</span>
              <br />
              Email :{" "}
              <a href="mailto:monto@montofinance.app" className="text-primary hover:underline">
                monto@montofinance.app
              </a>
              <br />
              Site web :{" "}
              <a href="https://montofinance.app" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                https://montofinance.app
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Données Personnelles Collectées</h2>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-2">3.1 Données que vous nous fournissez</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nom et prénom</li>
              <li>Adresse e-mail</li>
              <li>Numéro de téléphone</li>
              <li>Date de naissance</li>
              <li>Adresse postale</li>
              <li>Coordonnées bancaires (IBAN) — transmises de manière sécurisée à Stripe</li>
              <li>Photo de profil (optionnelle)</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-2">3.2 Données collectées automatiquement</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Données de connexion et d'utilisation de l'Application</li>
              <li>Informations sur les transactions financières réalisées via l'Application</li>
              <li>Données techniques (type d'appareil, système d'exploitation, identifiants de notification push)</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-2">3.3 Données financières</h3>
            <p>
              Toutes les transactions financières sont traitées par Stripe, Inc. Nous ne stockons pas vos
              données de carte bancaire. Les informations bancaires (IBAN) sont transmises directement à Stripe
              via une connexion sécurisée et chiffrée. Stripe est soumis à sa propre politique de confidentialité
              disponible sur{" "}
              <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                https://stripe.com/privacy
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Finalités du Traitement</h2>
            <p className="mb-2">Nous utilisons vos données personnelles pour :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Créer et gérer votre compte utilisateur</li>
              <li>Traiter les paiements et les retraits via l'Application</li>
              <li>Vous permettre de créer et gérer des cagnottes partagées</li>
              <li>Vous envoyer des notifications relatives à votre compte (dépôts, retraits, activité des cagnottes)</li>
              <li>Assurer la sécurité de l'Application et prévenir la fraude</li>
              <li>Respecter nos obligations légales et réglementaires</li>
              <li>Améliorer nos services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Base Légale du Traitement</h2>
            <p className="mb-2">Le traitement de vos données repose sur les bases légales suivantes :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="text-foreground font-medium">Exécution du contrat</span> : pour fournir les services de l'Application</li>
              <li><span className="text-foreground font-medium">Obligation légale</span> : pour respecter les réglementations applicables en matière financière</li>
              <li><span className="text-foreground font-medium">Intérêt légitime</span> : pour améliorer nos services et assurer la sécurité de la plateforme</li>
              <li><span className="text-foreground font-medium">Consentement</span> : pour l'envoi de notifications push (vous pouvez retirer votre consentement à tout moment)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Partage des Données</h2>
            <p className="font-medium text-foreground">Nous ne vendons pas vos données personnelles.</p>
            <p className="mt-2">Nous partageons vos données uniquement avec :</p>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-2">6.1 Prestataires de services</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="text-foreground font-medium">Stripe, Inc.</span> (traitement des paiements) — Politique de confidentialité :{" "}
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  https://stripe.com/privacy
                </a>
              </li>
              <li>
                <span className="text-foreground font-medium">Supabase</span> (hébergement de la base de données et authentification) — serveurs situés dans l'Union Européenne
              </li>
              <li>
                <span className="text-foreground font-medium">Resend</span> (envoi d'e-mails transactionnels)
              </li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-2">6.2 Obligations légales</h3>
            <p>
              Nous pouvons divulguer vos données si la loi l'exige ou dans le cadre d'une procédure judiciaire.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Durée de Conservation</h2>
            <p>
              Nous conservons vos données personnelles aussi longtemps que votre compte est actif. En cas de
              fermeture de compte, vos données sont supprimées dans un délai de 30 jours, sauf obligation
              légale de conservation plus longue (notamment pour les données financières, conservées 5 ans
              conformément à la réglementation française).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Sécurité des Données</h2>
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos
              données personnelles contre tout accès non autorisé, perte ou divulgation. Ces mesures comprennent
              le chiffrement des données en transit (HTTPS/TLS), le stockage sécurisé des identifiants, et des
              contrôles d'accès stricts à notre base de données.
            </p>
            <p className="mt-2">
              Toutefois, aucune transmission de données via Internet n'est totalement sécurisée. Nous ne pouvons
              garantir la sécurité absolue des données transmises via l'Application.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Vos Droits</h2>
            <p className="mb-2">
              Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits
              suivants :
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="text-foreground font-medium">Droit d'accès</span> : obtenir une copie de vos données personnelles</li>
              <li><span className="text-foreground font-medium">Droit de rectification</span> : corriger des données inexactes</li>
              <li><span className="text-foreground font-medium">Droit à l'effacement</span> : demander la suppression de vos données</li>
              <li><span className="text-foreground font-medium">Droit à la portabilité</span> : recevoir vos données dans un format structuré</li>
              <li><span className="text-foreground font-medium">Droit d'opposition</span> : vous opposer au traitement de vos données</li>
              <li><span className="text-foreground font-medium">Droit à la limitation</span> : limiter le traitement de vos données</li>
            </ul>
            <p className="mt-2">
              Pour exercer ces droits, contactez-nous à :{" "}
              <a href="mailto:monto@montofinance.app" className="text-primary hover:underline">
                monto@montofinance.app
              </a>
            </p>
            <p className="mt-2">
              Vous avez également le droit de déposer une plainte auprès de la CNIL (Commission Nationale de
              l'Informatique et des Libertés) :{" "}
              <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                https://www.cnil.fr
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Mineurs</h2>
            <p>
              L'Application est destinée aux utilisateurs âgés de 18 ans et plus. Nous ne collectons pas
              sciemment de données personnelles de personnes de moins de 18 ans. Si nous apprenons qu'un mineur
              a créé un compte, nous supprimerons ses données dans les plus brefs délais.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. Cookies et Technologies Similaires</h2>
            <p>
              L'Application utilise des technologies de stockage local (localStorage, sessionStorage) uniquement
              à des fins fonctionnelles, notamment pour maintenir votre session de connexion. Nous n'utilisons
              pas de cookies à des fins publicitaires ou de suivi tiers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">12. Modifications de la Politique</h2>
            <p>
              Nous nous réservons le droit de modifier la présente Politique de Confidentialité à tout moment.
              Toute modification sera notifiée via l'Application. La date de « dernière mise à jour » en haut
              de ce document sera modifiée en conséquence. L'utilisation continue de l'Application après
              notification constitue votre acceptation des modifications.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">13. Contact</h2>
            <p>
              Pour toute question relative à la présente Politique de Confidentialité ou à l'utilisation de vos
              données personnelles, contactez-nous :
            </p>
            <p className="mt-2">
              <span className="text-foreground font-medium">Fortis Invest — Monto</span>
              <br />
              Email :{" "}
              <a href="mailto:monto@montofinance.app" className="text-primary hover:underline">
                monto@montofinance.app
              </a>
              <br />
              Site web :{" "}
              <a href="https://montofinance.app" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                https://montofinance.app
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
