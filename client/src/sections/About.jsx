import FadeIn from '../components/FadeIn.jsx';
import Badge from '../components/Badge.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';

export default function About() {
  return (
    <section id="about" className="bg-white py-16 text-gray-900 dark:bg-black dark:text-gray-100">
      <FadeIn
        className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-[1.25fr_1fr] md:items-center"
        delayStep={0.18}
      >
        <SectionTitle
          eyebrow="About"
          title="Led by precision"
          description="Founder and lead artist Nova Clarke blends architectural linework with meditative shading to create pieces that age with intention."
        />
        <div className="space-y-6">
          <Card className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Sessions are collaborative and paced. Expect quiet stretches for focus, grounded check-ins, and aftercare
              designed for busy schedules. We keep tools minimal, sanitation obsessive, and communication clear.
            </p>
            <div className="flex flex-wrap gap-3">
              <Badge>BBP Certified</Badge>
              <Badge>8+ Years in Studio</Badge>
            </div>
          </Card>
        </div>
      </FadeIn>
    </section>
  );
}
