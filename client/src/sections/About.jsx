import FadeIn from '../components/FadeIn.jsx';
import Badge from '../components/Badge.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import artistPhoto from '../assets/melodi/melodiShowingNails.JPG';

const credentials = [
  'Natural nail care focus',
  'Detailed prep and structure',
  'Guest-friendly online booking',
];

export default function About() {
  return (
    <section
      id="about"
      className="relative overflow-hidden bg-gradient-to-br from-[#fffaf5] via-[#f6efe7] to-[#ece7e2] py-20 text-[#23301d]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(200,175,143,0.16),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(111,120,99,0.14),transparent_22%)]" />
      <FadeIn
        className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-[1.15fr_1fr]"
        delayStep={0.18}
      >
        <div className="space-y-6">
          <div className="group inline-flex items-center gap-4">
            <span className="relative inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
              <span className="absolute -left-14 h-[2px] w-0 rounded-full bg-[#8d755a] transition-all duration-500 group-hover:w-10" />
              About
            </span>
            <span className="h-[2px] w-10 rounded-full bg-[#8d755a]" />
          </div>

          <SectionTitle
            eyebrow={null}
            title="El arte de tus unas"
            description="Melodi Nails is built around beautiful finishes, healthy prep, and a welcoming appointment experience. The goal is simple: help every client leave with nails that feel polished, intentional, and uniquely theirs."
          />

          <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">
            <Badge className="bg-[#f3e7d9] text-[#2a3923] ring-1 ring-[#dbc9b4]">
              Clean beauty
            </Badge>
            <Badge className="bg-[#f3e7d9] text-[#2a3923] ring-1 ring-[#dbc9b4]">
              Personalized service
            </Badge>
          </div>
        </div>

        <Card className="relative overflow-hidden border-none bg-white/90 p-0 shadow-2xl ring-1 ring-[#d9cbbc]/70 transition duration-500 hover:-translate-y-1 hover:shadow-[0_25px_80px_rgba(42,57,35,0.16)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#c8af8f]" />
          <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8">
            <div className="relative overflow-hidden rounded-xl shadow-lg">
              <img
                src={artistPhoto}
                alt="Melodi showing a finished nail set"
                loading="lazy"
                className="h-full w-full rounded-xl object-cover transition duration-700 ease-out hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/10" />
            </div>

            <ul className="mt-6 space-y-3">
              {credentials.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-4 rounded-xl border border-[#efe2d3] bg-gradient-to-br from-[#fffdf9] to-[#f3ebe1] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#32412a] shadow-sm transition hover:translate-x-1 hover:shadow-md"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2a3923] text-[11px] font-bold text-white shadow-md">
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
