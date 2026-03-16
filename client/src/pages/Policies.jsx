import SectionTitle from '../components/SectionTitle.jsx';

const WAIVER_STATEMENTS = [
  'I have been read and fully informed of the risks associated with getting a tattoo. I freely accept and expressly assume any and all risks that may arise from tattooing.',
  'I waive and release to the fullest extent permitted by law any person of the Tattoo Studio from all liability, including claims for personal injury, whether caused by negligence or otherwise.',
  'The Tattoo Studio has given me the full opportunity to ask any question about the procedure and all of my questions have been answered to my satisfaction.',
  'The Tattoo Studio has given me instructions on the care of my tattoo while it is healing; I understand infection is possible if I do not follow those instructions.',
  'I am not under the influence of alcohol or drugs and am voluntarily submitting to be tattooed without duress or coercion.',
  'I do not suffer from diabetes, epilepsy, hemophilia, heart conditions, nor take blood thinners; I do not have any medical or skin condition that may interfere with the procedure or healing, and I am not pregnant, nursing, or mentally impaired.',
  'I am not allergic to lidocaine, and I consent to its use as a numbing agent unless I inform my artist otherwise.',
  'The Tattoo Studio is not responsible for the meaning or spelling of the symbol or text I provide or choose from the flash sheets.',
  'Variations in color and design may exist between my selected art and the tattoo when it is applied, and the colors will fade over time.',
  'A tattoo is a permanent change and can only be removed surgically or with laser, which may be disfiguring and costly.',
  'I release the right to any photographs taken of me and consent to their reproduction unless I expressly inform the Tattoo Studio not to take pictures.',
  'I agree that the Tattoo Studio has a NO REFUND policy on tattoos, piercing, retail sales, and deposits made to secure appointments.',
  'I agree to reimburse the Tattoo Studio for any attorneys’ fees and costs if legal action I bring results in the Studio or Artist being the prevailing party.',
  'I acknowledge that I was not presented this document at the last minute and that I understand I am signing a contract waiving certain rights.',
  'If any provision of this release is invalid or unenforceable, it shall be severed and the remainder shall remain in effect.',
  'I hereby declare that I am of legal age, competent to sign this agreement, and have provided valid proof of age and identification.',
  'I have read this agreement, I understand it, and I agree to be bound by it.'
];

const VARIATION_PARAGRAPHS = [
  'I acknowledge that if I have any condition that might affect the healing of this tattoo, I will advise my tattooer. I am not pregnant or nursing, and I am not under the influence of alcohol or drugs.',
  'I do not have medical or skin conditions, such as acne, keloid scarring, eczema, psoriasis, freckles, moles, or sunburn in the area to be tattooed that may interfere with the work. If I have any infection or rash anywhere on my body, I will advise my tattooer.',
  'I acknowledge it is not reasonably possible for the artist to determine whether I might have an allergic reaction to the pigments or processes, and I agree to accept that risk.',
  'I acknowledge that infection is always possible, especially if I do not take proper care of my tattoo. I have received aftercare instructions and agree to follow them; any touch-up work needed due to my own negligence will be done at my own expense.',
  'I understand that variations in color and design may exist between the art I selected and the tattoo as applied, and that darker skin may not display colors as bright as on light skin.',
  'I understand that prior or future skin treatments, laser hair removal, plastic surgery, or other skin-altering procedures may result in adverse changes to my tattoo.',
  'I acknowledge that a tattoo is a permanent change to my appearance, and I have been told no representations have been made regarding the ability to remove it later.',
  'I confirm that, to my knowledge, I do not have a physical, mental, or medical impairment that would affect my wellbeing as a direct or indirect result of choosing to be tattooed.',
  'I acknowledge I am over eighteen, that obtaining a tattoo is my choice alone, and I consent to any actions reasonably necessary by the studio to perform the procedure.'
];

const DISCLAIMER_POINTS = [
  'Neither we nor any of our third-party licensors or suppliers make any representations or warranties of any kind regarding the platform, and we disclaim all implied warranties, including merchantability and fitness for a particular purpose.',
  'We do not warrant that the site will function as described, be uninterrupted, free of harmful components, or that any content uploaded, downloaded, or stored will be timely, current, secure, or not lost or corrupted.',
  'In no event will Blackworknyc LLC be liable for damages arising from the use of the services, including direct, indirect, consequential, incidental, special, or punitive damages pursuant to applicable law.'
];

const ACCOUNTS_POINTS = [
  'You are solely responsible for all activities that occur under your account and must maintain the confidentiality of any credentials provided.',
  'Blackworknyc LLC may limit, suspend, deactivate, or cancel your account at any time without notice if you provide false information or violate these Terms.',
  'You may cancel your account at any time via the cancel feature on the site or by emailing artem@blackworknyc.com.'
];

const PAYMENT_POINTS = [
  'Once registered, you may place orders as described on the site, but Blackworknyc LLC reserves the right to accept, refuse, place on hold, or cancel any order and may require you to provide additional information.',
  'Fees are due in full at order confirmation, and recurring charges are billed according to each User Feature. You authorize Blackworknyc LLC to charge your selected payment method.',
  'Shipping carrier selection, charges, and delivery dates are determined by us, and orders may arrive in multiple shipments.',
  'All sales are final unless otherwise stated, and claims regarding goods must be emailed within five days of receiving your order; we are not obligated to issue a refund.'
];

const DISPUTE_PARAGRAPHS = [
  'You and Blackworknyc LLC agree that any dispute arising from or relating to these Terms will be settled by binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules and Supplementary Procedures for Consumer Related Disputes.',
  'The arbitration will be conducted in New York, New York, unless both parties agree otherwise, and if your claim does not exceed $10,000, the arbitration proceeds on the documented record unless you request a hearing.',
  'You and the Company each waive the right to a trial by jury and agree that the arbitrator may not consolidate more than one person’s claims or preside over any class or representative proceeding.',
  'Judgment on any arbitration award may be entered in a court having jurisdiction thereof, and any award must be consistent with the limitation of liability set forth above.'
];

const GENERAL_POINTS = [
  'Any notices from Blackworknyc LLC will be in writing and delivered via email or by posting to the website.',
  'These Terms are governed by the laws of the State of New York and any disputes for which injunctive or equitable relief is requested must be brought in New York County state or federal court.',
  'If any provision of these Terms is found invalid or unenforceable, the remainder will remain in full force.',
  'Failure to enforce any right does not constitute a waiver, and any invalid arbitration or court ruling will be enforced to the maximum extent permissible.',
  'These Terms represent the entire agreement between you and Blackworknyc LLC and may not be assigned by you, though Blackworknyc LLC may assign them at its discretion.',
  'Sections covering Definitions, Acknowledgments and Disclaimers, Intellectual Property, Limitation of Liability, Indemnification, Dispute Resolution, and General Provisions shall survive termination of these Terms.'
];

export default function Policies() {
  return (
    <main className="bg-white text-gray-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
        <SectionTitle
          eyebrow="Policies"
          title="Terms of Service & Tattoo Consent"
          description="Please read these Terms of Service, the Tattoo Consent Form, and supplementary policies carefully before booking."
        />

        <div className="space-y-6 text-xs uppercase tracking-[0.3em] text-gray-500">
          <p>BLACKWORKNYC LLC</p>
          <p>Brooklyn, NY · November, 2025</p>
        </div>

        <section className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-gray-700">Tattoo Consent Form</p>
            <p className="text-xs uppercase tracking-[0.35em] text-gray-500">
              READING TO SHOW THAT YOU UNDERSTAND EACH PROVISION. FEEL FREE TO ASK ANY QUESTIONS REGARDING THIS WAIVER.
            </p>
          </div>
          <p className="text-sm text-gray-600">
            In consideration of receiving a tattoo from Blackworknyc LLC, including its artists, associates, apprentices,
            agents, or employees (collectively the Tattoo Studio), I agree to the following:
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
            IMPORTANT: PLEASE ASK YOUR ARTIST ABOUT THE PRICE OF YOUR TATTOO BEFORE BEGINNING THE PROCEDURE - it is your
            responsibility to confirm the price of the tattoo.
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
            Blackworknyc LLC provides an online informational site regarding the company’s tattooing services. The Terms
            include this Tattoo Consent release, guidelines, and any supplemental terms posted for updates or information
            purposes. Our privacy practices are described in the Privacy Policy available at{' '}
            <a
              className="underline text-gray-900"
              href="https://www.blackworknyc.com/privacy-policy"
              target="_blank"
              rel="noreferrer"
            >
              https://www.blackworknyc.com/privacy-policy
            </a>
            . By accessing or submitting information, you confirm you have read, understand, and agree to comply with all
            of these Terms. If you do not, you are not authorized to access the service.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            Explanation of the Site
          </p>
          <p className="text-sm text-gray-600">
            Blackworknyc LLC may provide an online interactive and informational website through which it shares
            information about its tattooing services and related offerings. In some cases, the Site offers e-commerce
            services and links to third-party dealers, distributors, and affiliates. Notwithstanding the foregoing, the Site
            is provided for informational purposes only.
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
            You are responsible for compliance with all applicable laws when using the site. Blackworknyc LLC reserves the
            right to investigate violations and remove any material it deems objectionable or harmful.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            Intellectual Property and User License
          </p>
          <p className="text-sm text-gray-600">
            Blackworknyc LLC grants you a limited, non-exclusive license to access and use the site and any content
            provided by us solely for your use. You agree not to copy, adapt, modify, create derivative works, distribute,
            license, sell, transmit, broadcast, or otherwise exploit the site except as expressly permitted.
          </p>
          <p className="text-sm text-gray-600">
            By providing any User Content, you grant Blackworknyc LLC a worldwide, irrevocable, perpetual, royalty-free
            license to use, copy, adapt, distribute, and create derivative works from that content.
          </p>
          <p className="text-sm text-gray-600">
            If you submit Suggestions for improvements, all rights in those Suggestions are assigned to Blackworknyc LLC.
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
            Blackworknyc LLC each waive the right to a jury trial and to participate in class or representative proceedings.
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
            Blackworknyc LLC<br />
            Email: <a className="underline" href="mailto:artem@blackworknyc.com">artem@blackworknyc.com</a>
          </p>
        </section>
      </div>
    </main>
  );
}
