import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext.jsx';

export default function BlogIndex() {
  const { isSpanish } = useLanguage();
  const copy = isSpanish
    ? {
        title: 'Journal de Melodi Nails',
        description:
          'Compartimos respuestas utiles sobre el salon, recomendaciones de cuidado y consejos para prepararte para tu proximo manicure, pedicure, gel o acrilico en el Bronx.',
        featured: 'Destacado',
        readMore: 'Leer mas ->',
        posts: [
          {
            title: 'Guia de Cuidado de Unas',
            description:
              'Pasos simples para que tu servicio en gel, acrilico o unas naturales se mantenga limpio, brillante y duradero.',
            to: 'aftercare',
          },
          {
            title: 'Preguntas Frecuentes del Salon',
            description:
              'Respuestas claras sobre reservas, preparacion, reparaciones, tiempos y lo que puedes esperar en Melodi Nails.',
            to: 'faq',
          },
          {
            title: 'Como se crea un set exclusivo',
            description:
              'Una mirada al proceso de preparacion, estructura, forma y acabado de Melodi Nails para resultados pulidos y listos para foto.',
            to: 'custom-fine-line',
          },
        ],
      }
    : {
        title: 'Melodi Nails Journal',
        description:
          'We use this space to answer common salon questions, share aftercare guidance, and help clients prepare for their next manicure, pedicure, acrylic, or gel appointment in the Bronx.',
        featured: 'Featured',
        readMore: 'Read more ->',
        posts: [
          {
            title: 'Nail Aftercare Guide',
            description:
              'Simple steps to help your gel, acrylic, or natural nail service stay clean, glossy, and long-lasting.',
            to: 'aftercare',
          },
          {
            title: 'Nail Salon FAQ',
            description: 'Clear answers about booking, prep, repairs, timing, and what to expect at Melodi Nails.',
            to: 'faq',
          },
          {
            title: 'How a Signature Nail Set Comes Together',
            description:
              "A look at Melodi Nails' prep, shaping, structure, and finishing process for polished, photo-ready results.",
            to: 'custom-fine-line',
          },
        ],
      };
  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
          Insights
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          {copy.title}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-gray-600">
          {copy.description}
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        {copy.posts.map((post) => (
          <BlogPreview key={post.to} {...post} featured={copy.featured} readMore={copy.readMore} />
        ))}
      </div>
    </article>
  );
}

function BlogPreview({ title, description, to, featured, readMore }) {
  return (
    <Link
      to={to}
      className="block rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-gray-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">{featured}</p>
      <h2 className="mt-4 text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">{description}</p>
      <span className="mt-4 inline-flex items-center text-sm font-medium text-black transition hover:underline">
        {readMore}
      </span>
    </Link>
  );
}
