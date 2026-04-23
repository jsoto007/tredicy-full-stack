import SectionTitle from '../components/SectionTitle.jsx';

const RESTRICTIONS = [
  'Copy, download, distribute, sell, sublicense, lease, or otherwise commercially exploit the Software or any portion of its source or compiled code;',
  'Fork, clone, duplicate, or host any portion of the Software or repository in any environment, public or private;',
  'Reverse-engineer, decompile, disassemble, or create derivative works of the Software;',
  'Modify, adapt, or repurpose the Software for other businesses, entities, websites, or third parties;',
  'Transfer, share, or expose system code, access credentials, or repository links with any unauthorized person or entity;',
  'Store, share, publish, or upload the Software (in part or whole) to any code hosting or version control service;',
  'Claim any ownership or intellectual property rights in the Software or any of its components.',
];

const TERMINATION_POINTS = [
  'The Client\'s right to use the Software shall immediately cease.',
  'The Client shall retain ownership of all customer data and may request an export in a mutually agreed format.',
  'All rights to the Software revert entirely to Soto Dev, LLC.',
];

export default function LicensePage() {
  return (
    <main className="bg-white text-gray-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
        <SectionTitle
          eyebrow="Legal"
          title="Software License Agreement"
          description="This agreement governs the use of software developed and owned by Soto Dev, LLC for Tredici Social."
        />

        <div className="space-y-6 text-xs uppercase tracking-[0.3em] text-gray-500">
          <p>Soto Dev, LLC</p>
          <p>Effective Date: April 23, 2026</p>
        </div>

        <section className="space-y-4">
          <p className="text-sm text-gray-600">
            This Software License Agreement ("Agreement") is entered into by and between{' '}
            <strong>Soto Dev, LLC</strong> ("Licensor") and <strong>Tredici Social</strong> ("Client"),
            collectively referred to as the "Parties."
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            1. Ownership of Software
          </p>
          <p className="text-sm text-gray-600">
            All source code, compiled code, algorithms, system architecture, data structures, workflows,
            business logic, visual design elements, and any other intellectual property created, developed,
            or provided by Soto Dev, LLC (the "Software") shall remain the sole and exclusive property of
            Soto Dev, LLC.
          </p>
          <p className="text-sm text-gray-600">
            This Agreement does not constitute a sale or transfer of ownership rights. It grants the Client
            only the limited license explicitly described herein.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            2. Ownership of Customer Data
          </p>
          <p className="text-sm text-gray-600">
            All customer-related data entered, uploaded, or generated through use of the Software —
            including but not limited to reservations, user accounts, images, contact information, and
            operational data specific to Tredici Social — shall remain the exclusive property of Tredici
            Social.
          </p>
          <p className="text-sm text-gray-600">
            Soto Dev, LLC shall not access, share, or use such customer data except as necessary to
            operate, maintain, support, or improve the Software, consistent with applicable privacy laws.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            3. License Grant
          </p>
          <p className="text-sm text-gray-600">
            Soto Dev, LLC grants Tredici Social a limited, revocable, non-exclusive, non-transferable, and
            non-sublicensable license to use the Software solely for its internal business operations.
          </p>
          <p className="text-sm text-gray-600">
            This license does not grant any rights to copy, modify, distribute, resell, or re-deploy the
            Software beyond normal operation, unless expressly authorized in writing by Soto Dev, LLC.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            4. Restrictions
          </p>
          <p className="text-sm text-gray-600">
            The Client shall not, directly or indirectly:
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            {RESTRICTIONS.map((item) => (
              <li key={item} className="list-disc pl-5">
                {item}
              </li>
            ))}
          </ul>
          <p className="text-sm text-gray-600">
            All rights not expressly granted to the Client are retained by Soto Dev, LLC.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            5. Software Provided "As Is"
          </p>
          <p className="text-sm text-gray-600">
            The Software is provided "AS IS" and "AS AVAILABLE," without any warranties of any kind,
            whether express, implied, or statutory.
          </p>
          <p className="text-sm text-gray-600">
            Without limiting the foregoing, Soto Dev, LLC specifically disclaims any implied warranties of
            merchantability, fitness for a particular purpose, accuracy, reliability, or uninterrupted
            availability. The Client assumes full responsibility and risk for the use and operation of the
            Software.
          </p>
          <p className="text-sm text-gray-600">
            Soto Dev, LLC is not responsible for performance issues caused by third-party services, hosting
            providers, network outages, or changes to external dependencies.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            6. Support and Modifications
          </p>
          <p className="text-sm text-gray-600">
            Any updates, bug fixes, or enhancements are provided solely at the discretion of Soto Dev, LLC.
            Requests for new features or custom modifications may require a separate agreement and
            additional fees.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            7. Security and Data Protection
          </p>
          <p className="text-sm text-gray-600">
            Soto Dev, LLC will employ commercially reasonable technical and administrative measures to
            safeguard the Software and customer data against unauthorized access, loss, or disclosure.
          </p>
          <p className="text-sm text-gray-600">
            The Client is responsible for managing user access, protecting login credentials, and ensuring
            proper use of the Software within its organization.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            8. Limitation of Liability
          </p>
          <p className="text-sm text-gray-600">
            To the fullest extent permitted by law, Soto Dev, LLC shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages, including but not limited to loss of
            data, business interruption, or lost profits.
          </p>
          <p className="text-sm text-gray-600">
            The total cumulative liability of Soto Dev, LLC under this Agreement shall not exceed the total
            fees paid by the Client during the twelve (12) months preceding the claim.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            9. Term and Termination
          </p>
          <p className="text-sm text-gray-600">
            This Agreement remains in effect until terminated by either party with written notice. Upon
            termination:
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            {TERMINATION_POINTS.map((point) => (
              <li key={point} className="list-disc pl-5">
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            10. Governing Law
          </p>
          <p className="text-sm text-gray-600">
            This Agreement shall be governed and construed in accordance with the laws of the State of New
            Jersey, without regard to conflict-of-law principles.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            11. Entire Agreement
          </p>
          <p className="text-sm text-gray-600">
            This Agreement constitutes the complete understanding between the Parties with respect to its
            subject matter and supersedes all previous agreements, communications, or proposals, whether
            oral or written.
          </p>
        </section>

        <section className="space-y-2 text-sm text-gray-600">
          <p>For questions regarding this license, contact:</p>
          <p>
            Soto Dev, LLC
            <br />
            Email:{' '}
            <a className="underline" href="mailto:help@sotodev.com">
              help@sotodev.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
