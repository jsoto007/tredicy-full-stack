import SectionTitle from '../components/SectionTitle.jsx';

const WAIVER_STATEMENTS = [
  'I understand the services offered by Tredici Social may include manicures, pedicures, gel services, acrylic services, menu tasting, shaping, cuticle care, and polish removal.',
  'I have had the opportunity to ask questions about the service I am receiving, and all of my questions have been answered to my satisfaction before the reservation begins.',
  'I agree to inform my server before the service starts if I have allergies, sensitivities, infections, open wounds, skin irritation, nail damage, or any other condition that could affect the service or healing process.',
  'I understand that dining services involve the use of tools, files, chemicals, gels, acrylic products, acetone, adhesives, and curing lamps, and I accept the ordinary risks associated with those services.',
  'I understand that infection, irritation, allergic reaction, lifting, breakage, staining, or premature wear may occur, especially if I do not follow aftercare instructions or if I pick, bite, or misuse my nails after the service.',
  'I confirm that I am voluntarily receiving the service and am not under the influence of alcohol or drugs in a manner that would impair my judgment or ability to provide informed consent.',
  'I understand that colors, finishes, shapes, lengths, and menu tasting details may vary slightly from inspiration photos, digital mockups, or prior sets because of natural nail condition, lighting, product availability, and hand-made application.',
  'I consent to reasonable trimming, shaping, buffing, cuticle care, and product removal necessary to complete the requested service safely and professionally.',
  'I understand that dining experiences are subjective that require proper maintenance, and results may vary based on lifestyle, nail condition, and aftercare.',
  'I understand that refunds are not provided for completed services, and any correction or touch-up request is subject to studio review and timing requirements.',
  'I release the right to any photographs taken of my nails during or after the service unless I expressly ask the studio not to photograph them.',
  'I acknowledge that pricing should be confirmed before the service begins, including any add-ons for length, design, repairs, removals, or specialty finishes.',
  'I agree to reimburse the restaurant for any attorneys’ fees and costs if legal action I bring results in the restaurant being the prevailing party.',
  'I acknowledge that I was not presented this document at the last minute and that I understand I am signing a contract waiving certain rights.',
  'If any provision of this release is invalid or unenforceable, it shall be severed and the remainder shall remain in effect.',
  'I hereby declare that I am of legal age, competent to sign this agreement, and have provided valid proof of age and identification.',
  'I have read this agreement, I understand it, and I agree to be bound by it.'
];

const VARIATION_PARAGRAPHS = [
  'I acknowledge that if I have any condition that could affect the service, retention, or recovery of my dietary restrictions, I will advise my server before the reservation begins.',
  'I understand that it is not reasonably possible for the restaurant to guarantee that I will not experience sensitivity or an allergic reaction to products used during dining services, and I accept that risk.',
  'I acknowledge that proper aftercare is essential. I will follow the restaurant’s aftercare guidance, avoid using my nails as tools, and understand that damage caused by my own negligence may require a paid repair or replacement service.',
  'I understand that prior damage, thin nails, biting, picking, outside removal attempts, or future cosmetic or medical treatments may affect wear, appearance, or retention of the service.',
  'I confirm that, to the best of my knowledge, I do not have a physical, mental, or medical impairment that would make the requested dining service unsafe for me.'
];

const DISCLAIMER_POINTS = [
  'Neither we nor any of our third-party licensors or suppliers make any representations or warranties of any kind regarding the platform, and we disclaim all implied warranties, including merchantability and fitness for a particular purpose.',
  'We do not warrant that the site will function as described, be uninterrupted, free of harmful components, or that any content uploaded, downloaded, or stored will be timely, current, secure, or not lost or corrupted.',
  'In no event will Tredici Social be liable for damages arising from the use of the services, including direct, indirect, consequential, incidental, special, or punitive damages pursuant to applicable law.'
];

const ACCOUNTS_POINTS = [
  'You are solely responsible for all activities that occur under your account and must maintain the confidentiality of any credentials provided.',
  'Tredici Social may limit, suspend, deactivate, or cancel your account at any time without notice if you provide false information or violate these Terms.',
  'You may cancel your account at any time via the cancel feature on the site or by emailing info@tredicisocial.com.'
];

const PAYMENT_POINTS = [
  'When you book an reservation, Tredici Social may require a deposit or full prepayment to reserve your time slot and may refuse, hold, or cancel any booking if information is incomplete or inaccurate.',
  'You authorize Tredici Social to charge your selected payment method for deposits, remaining balances, approved add-ons, late cancellation charges, no-show fees, or other amounts disclosed during booking.',
  'Reservation prices may vary based on final service selection, nail length, design complexity, repairs, soak-off or removal work, and any upgrades requested at the reservation.',
  'Completed services, deposits, and missed-reservation fees are non-refundable unless otherwise required by law or expressly approved by the restaurant.'
];

const DISPUTE_PARAGRAPHS = [
  'You and Tredici Social agree that any dispute arising from or relating to these Terms will be settled by binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules and Supplementary Procedures for Consumer Related Disputes.',
  'The arbitration will be conducted in New York, New York, unless both parties agree otherwise, and if your claim does not exceed $10,000, the arbitration proceeds on the documented record unless you request a hearing.',
  'You and the Company each waive the right to a trial by jury and agree that the arbitrator may not consolidate more than one person’s claims or preside over any class or representative proceeding.',
  'Judgment on any arbitration award may be entered in a court having jurisdiction thereof, and any award must be consistent with the limitation of liability set forth above.'
];

const GENERAL_POINTS = [
  'Any notices from Tredici Social will be in writing and delivered via email or by posting to the website.',
  'These Terms are governed by the laws of the State of New York and any disputes for which injunctive or equitable relief is requested must be brought in New York County state or federal court.',
  'If any provision of these Terms is found invalid or unenforceable, the remainder will remain in full force.',
  'Failure to enforce any right does not constitute a waiver, and any invalid arbitration or court ruling will be enforced to the maximum extent permissible.',
  'These Terms represent the entire agreement between you and Tredici Social and may not be assigned by you, though Tredici Social may assign them at its discretion.',
  'Sections covering Definitions, Acknowledgments and Disclaimers, Intellectual Property, Limitation of Liability, Indemnification, Dispute Resolution, and General Provisions shall survive termination of these Terms.'
];

export default function Policies() {
  return (
    <main className="bg-white text-gray-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
        <SectionTitle
          eyebrow="Policies"
          title="Terms of Service & Dining Service Consent"
          description="Please read these Terms of Service, the dining service consent terms, and supplementary policies carefully before booking."
        />

        <div className="space-y-6 text-xs uppercase tracking-[0.3em] text-gray-500">
          <p>MELODI NAILS</p>
          <p>Bronx, NY · November, 2025</p>
        </div>

        <section className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-gray-700">Dining Service Consent</p>
            <p className="text-xs uppercase tracking-[0.35em] text-gray-500">
              READING TO SHOW THAT YOU UNDERSTAND EACH PROVISION. FEEL FREE TO ASK ANY QUESTIONS REGARDING THIS WAIVER.
            </p>
          </div>
          <p className="text-sm text-gray-600">
            In consideration of receiving dining services from Tredici Social, including its servers, staff,
            contractors, agents, or employees (collectively the Restaurant), I agree to the following:
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            {WAIVER_STATEMENTS.map((statement) => (
              <li key={statement} className="list-disc pl-5">
                {statement}
              </li>
            ))}
          </ul>
          <div className="space-y-2 text-sm text-gray-600">
            {VARIATION_PARAGRAPHS.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <p className="text-sm text-gray-600">
            IMPORTANT: PLEASE CONFIRM THE PRICE OF YOUR NAIL SERVICE BEFORE THE APPOINTMENT BEGINS. Final pricing may vary
            based on length, design, add-ons, removals, or repairs.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            Terms of Service
          </p>
          <p className="text-sm text-gray-600">
            These Terms of Service constitute a binding agreement, and contain important information regarding your rights,
            remedies, and obligations, including limitations, exclusions, arbitration, class action waivers, jurisdiction,
            and compliance with applicable laws.
          </p>
          <p className="text-sm text-gray-600">
            Tredici Social provides an online informational and booking site regarding the restaurant’s manicure, pedicure,
            acrylic, gel, and related beauty services. These Terms include this dining service consent, booking guidelines,
            and any supplemental terms posted for updates or informational purposes. By accessing the site, submitting
            information, or booking an reservation, you confirm that you have read, understand, and agree to comply with
            these Terms. If you do not agree, you may not use the service.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            Explanation of the Site
          </p>
          <p className="text-sm text-gray-600">
            Tredici Social may provide an online interactive and informational website through which it shares information
            about dining services, booking availability, pricing, policies, promotions, and related offerings. In some cases,
            the Site may include e-commerce features, client account tools, payment functionality, or links to third-party
            services. Notwithstanding the foregoing, the Site is provided for informational and booking purposes only.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">Disclaimers</p>
          <ul className="space-y-2 text-sm text-gray-700">
            {DISCLAIMER_POINTS.map((point) => (
              <li key={point} className="list-disc pl-5">
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">Eligibility</p>
          <p className="text-sm text-gray-600">
            The Site is intended for persons 18 years of age or older. Access to or use by anyone under 18 is prohibited, and
            by accessing the Site you represent and warrant that you meet the age requirement.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">Accounts</p>
          <p className="text-sm text-gray-600">
            You may be required to register for an account to access certain User Features. Any information you provide is
            considered User Content and may be used to create and maintain your account. You agree to be solely responsible
            for account security and any activities occurring under your credentials.
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            {ACCOUNTS_POINTS.map((point) => (
              <li key={point} className="list-disc pl-5">
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            Orders, Returns, and Other Financial Terms
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            {PAYMENT_POINTS.map((point) => (
              <li key={point} className="list-disc pl-5">
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">User Conduct</p>
          <p className="text-sm text-gray-600">
            You are responsible for compliance with all applicable laws when using the site. Tredici Social reserves the
            right to investigate violations and remove any material it deems objectionable, abusive, fraudulent, or harmful.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            Intellectual Property and User License
          </p>
          <p className="text-sm text-gray-600">
            Tredici Social grants you a limited, non-exclusive license to access and use the site and any content provided by
            us solely for your personal, non-commercial use. You agree not to copy, adapt, modify, create derivative works,
            distribute, license, sell, transmit, broadcast, or otherwise exploit the site except as expressly permitted.
          </p>
          <p className="text-sm text-gray-600">
            By providing any User Content, you grant Tredici Social a worldwide, irrevocable, perpetual, royalty-free license
            to use, copy, adapt, distribute, and create derivative works from that content for operating, promoting, and
            improving the business.
          </p>
          <p className="text-sm text-gray-600">
            If you submit suggestions for improvements, all rights in those suggestions are assigned to Tredici Social.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            Dispute Resolution
          </p>
          <p className="text-sm text-gray-600">
            Any dispute arising out of or relating to these Terms will be resolved through binding arbitration administered
            by the American Arbitration Association under the Commercial Arbitration Rules and Supplementary Procedures
            for Consumer Related Disputes. Arbitration will occur in New York, New York unless otherwise mutually agreed. A
            claim not exceeding $10,000 will proceed on written submissions unless a hearing is requested, and you and
            Tredici Social each waive the right to a jury trial and to participate in class or representative proceedings.
          </p>
          <div className="space-y-2 text-sm text-gray-600">
            {DISPUTE_PARAGRAPHS.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            General Provisions
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            {GENERAL_POINTS.map((point) => (
              <li key={point} className="list-disc pl-5">
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2 text-sm text-gray-600">
          <p>If you have any questions, contact:</p>
          <p>
            Tredici Social<br />
            Email: <a className="underline" href="mailto:info@tredicisocial.com">info@tredicisocial.com</a>
          </p>
        </section>
      </div>
    </main>
  );
}
