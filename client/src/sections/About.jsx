import FadeIn from '../components/FadeIn.jsx';
import Badge from '../components/Badge.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import artistPhoto from '../assets/about-artist.jpeg';

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
        description="Founder and lead artist Nova Clarke blends architectural linework, meditative shading, and storytelling to create pieces that age with intention."
        />
        <div className="space-y-6">
          <Card className="space-y-4">
            <img
              src={artistPhoto}
              alt="Tattoo artist Artem Ermochenko smiling while working"
              className="w-full rounded-lg object-cover shadow-md"
            />
            <div className="flex flex-wrap gap-3">
              <Badge>Licensed and Certified</Badge>
              <Badge>5+ Years Professional Tattooing</Badge>
            </div>
          </Card>
        </div>
      </FadeIn>
    </section>
  );
}
