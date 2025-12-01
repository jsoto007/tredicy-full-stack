import FadeIn from '../components/FadeIn.jsx';
import Badge from '../components/Badge.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import artistPhoto from '../assets/about-artist.jpeg';

const credentials = [
  'Licensed and Certified',
  '5+ Years Professional Tattooing',
  'Fine-line & Blackwork Specialist',
];

export default function About() {
  return (
    <section
      id="about"
      className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-gray-50 py-20 text-gray-900 dark:from-gray-950 dark:via-black dark:to-black dark:text-gray-100"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(129,140,248,0.07),transparent_22%)]" />
      <FadeIn
        className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-[1.15fr_1fr]"
        delayStep={0.18}
      >
        <div className="space-y-6">
          <div className="group inline-flex items-center gap-4">
            <span className="relative inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-gray-400">
              <span className="absolute -left-14 h-[2px] w-0 rounded-full bg-gray-400 transition-all duration-500 group-hover:w-10" />
              About
            </span>
            <span className="h-[2px] w-10 rounded-full bg-gray-400" />
          </div>

          <SectionTitle
            eyebrow={null}
            title="Led by precision"
            description="Founder and lead artist Nova Clarke blends architectural linework, meditative shading, and storytelling to create pieces that age with intention. Each session is guided by calm artistry, technical rigor, and a commitment to designs that feel personal for decades."
          />

          <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-700 dark:text-gray-200">
            <Badge className="bg-slate-100/80 text-gray-800 ring-1 ring-slate-200 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-800">
              Thoughtful consultation
            </Badge>
            <Badge className="bg-slate-100/80 text-gray-800 ring-1 ring-slate-200 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-800">
              Hygienic studio standards
            </Badge>
          </div>
        </div>

        <Card className="relative overflow-hidden border-none bg-white/90 p-0 shadow-2xl ring-1 ring-gray-200/70 transition duration-500 hover:-translate-y-1 hover:shadow-[0_25px_80px_rgba(0,0,0,0.12)] dark:border-gray-800 dark:bg-gray-900/80 dark:ring-gray-800/80">
          <div className="absolute inset-x-0 top-0 h-1 bg-gray-300" />
          <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8">
            <div className="relative overflow-hidden rounded-xl shadow-lg">
              <img
                src={artistPhoto}
                alt="Tattoo artist Artem Ermochenko smiling while working"
                className="h-full w-full rounded-xl object-cover transition duration-700 ease-out hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/10" />
            </div>

            <ul className="mt-6 space-y-3">
              {credentials.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-4 rounded-xl border border-gray-100/70 bg-gradient-to-br from-slate-50 to-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-800 shadow-sm transition hover:translate-x-1 hover:shadow-md dark:border-gray-800/70 dark:from-gray-900 dark:to-gray-900/80 dark:text-gray-100"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-700 text-[11px] font-bold text-white shadow-md">
                    ✓
                  </span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </FadeIn>
    </section>
  );
}
