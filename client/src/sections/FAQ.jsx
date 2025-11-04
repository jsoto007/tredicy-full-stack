import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import faqs from '../data/faq.json';

export default function FAQ() {
  return (
    <section id="faq" className="bg-white py-16 text-gray-900 dark:bg-black dark:text-gray-100">
      <FadeIn className="mx-auto flex max-w-6xl flex-col gap-12 px-6" delayStep={0.18}>
        <SectionTitle
          eyebrow="FAQ"
          title="Before you visit"
          description="Three quick answers to guide your prep, from session readiness to healing logistics."
        />
        <FadeIn className="space-y-6" delayStep={0.12}>
          {faqs.map((faq) => (
            <Card key={faq.id} className="space-y-3">
              <h3 className="text-base font-semibold uppercase tracking-[0.2em] text-gray-900 dark:text-gray-100">{faq.question}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{faq.answer}</p>
            </Card>
          ))}
        </FadeIn>
      </FadeIn>
    </section>
  );
}
