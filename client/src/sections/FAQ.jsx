import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import faqs from '../data/faq.json';

export default function FAQ() {
  return (
    <section id="faq" className="bg-[#ECE7E2] py-16 text-[#23301d]">
      <FadeIn className="mx-auto flex max-w-6xl flex-col gap-12 px-6" delayStep={0.18}>
        <SectionTitle
          eyebrow="FAQ"
          title="Before you visit"
          description="Three quick answers for booking, inspiration photos, and how payment works with the new nails appointment flow."
        />
        <FadeIn className="space-y-6" delayStep={0.12}>
          {faqs.map((faq) => (
            <Card key={faq.id} className="space-y-3">
              <h3 className="text-base font-semibold tracking-[0.08em] text-[#2a3923]">{faq.question}</h3>
              <p className="text-sm text-[#5e6755]">{faq.answer}</p>
            </Card>
          ))}
        </FadeIn>
      </FadeIn>
    </section>
  );
}
