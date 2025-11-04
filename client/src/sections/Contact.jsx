import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';

const CONTACT_POINTS = [
  {
    id: 'call',
    heading: 'Call',
    value: '(555) 010-2020',
    body: 'Leave a message before 7 PM for next-day responses.'
  },
  {
    id: 'email',
    heading: 'Email',
    value: 'hello@blackink.tattoo',
    body: 'Best for sharing reference links and photos.'
  },
  {
    id: 'studio',
    heading: 'Studio',
    value: '245 Mercer Street, Suite 4F, New York, NY',
    body: 'By appointment only. Buzz 4F on arrival.'
  }
];

export default function Contact() {
  return (
    <section id="contact" className="bg-gray-50 py-16 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <FadeIn className="mx-auto flex max-w-6xl flex-col gap-12 px-6" delayStep={0.16}>
        <SectionTitle
          eyebrow="Contact"
          title="Stay connected"
          description="We keep the studio patient and low volume. Reach out ahead of your visit so we can prepare the experience you need."
        />
        <FadeIn className="grid gap-8 md:grid-cols-3" childClassName="h-full" delayStep={0.1}>
          {CONTACT_POINTS.map((item) => (
            <Card key={item.id} className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">{item.heading}</p>
              <p className="text-base font-semibold uppercase tracking-[0.2em] text-gray-900 dark:text-gray-100">{item.value}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{item.body}</p>
            </Card>
          ))}
        </FadeIn>
        <FadeIn className="flex items-center gap-4" immediate delayStep={0.2}>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-gray-300 text-xs font-semibold uppercase tracking-[0.3em] text-gray-600 dark:border-gray-700 dark:text-gray-300">
            IG
          </span>
          <a
            href="https://www.instagram.com/blackworknyc/"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-600 underline-offset-4 hover:underline dark:text-gray-300"
            aria-label="Visit Blackwork NYC on Instagram"
          >
            instagram.com/blackworknyc
          </a>
        </FadeIn>
      </FadeIn>
    </section>
  );
}
