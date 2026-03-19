import { Link } from 'react-router-dom';

export default function BlogIndex() {
  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
          Insights
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Melodi Nails Journal
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-gray-600">
          We use this space to answer common salon questions, share aftercare guidance, and help clients prepare for
          their next manicure, pedicure, acrylic, or gel appointment in the Bronx.
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        <BlogPreview
          title="Nail Aftercare Guide"
          description="Simple steps to help your gel, acrylic, or natural nail service stay clean, glossy, and long-lasting."
          to="aftercare"
        />
        <BlogPreview
          title="Nail Salon FAQ"
          description="Clear answers about booking, prep, repairs, timing, and what to expect at Melodi Nails."
          to="faq"
        />
        <BlogPreview
          title="How a Signature Nail Set Comes Together"
          description="A look at Melodi Nails' prep, shaping, structure, and finishing process for polished, photo-ready results."
          to="custom-fine-line"
        />
      </div>
    </article>
  );
}

function BlogPreview({ title, description, to }) {
  return (
    <Link
      to={to}
      className="block rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-gray-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">Featured</p>
      <h2 className="mt-4 text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">{description}</p>
      <span className="mt-4 inline-flex items-center text-sm font-medium text-black transition hover:underline">
        Read more →
      </span>
    </Link>
  );
}
