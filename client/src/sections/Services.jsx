import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import services from '../data/services.json';

export default function Services() {
  return (
    <section id="services" className="bg-gray-50 py-16 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <FadeIn className="mx-auto flex max-w-6xl flex-col gap-12 px-6" delayStep={0.16}>
        <SectionTitle
          eyebrow="Services"
          title="Crafted with restraint"
          description="Every piece is drawn in-studio with an emphasis on balance, contrast, and longevity on skin. Explore the core offerings below."
        />
        <FadeIn className="grid gap-8 md:grid-cols-3" childClassName="h-full" delayStep={0.12}>
          {services.map((service) => (
            <Card key={service.id} className="h-full space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">{service.tagline}</p>
              <h3 className="text-xl font-semibold uppercase tracking-[0.2em] text-gray-900 dark:text-gray-100">
                {service.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{service.description}</p>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">{service.duration}</p>
            </Card>
          ))}
        </FadeIn>
      </FadeIn>
    </section>
  );
}
