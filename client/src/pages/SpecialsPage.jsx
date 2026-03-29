import FadeIn from '../components/FadeIn.jsx';

const SPECIALS = [
  {
    course: 'Starters',
    items: [
      {
        name: 'Burrata & Prosciutto',
        description: 'Hand-pulled burrata, San Daniele prosciutto, heirloom tomatoes, basil oil, aged balsamic',
      },
      {
        name: 'Grilled Octopus',
        description: 'Spanish octopus, Calabrian chili, white bean purée, pickled celery, smoked paprika oil',
      },
      {
        name: 'Beef Carpaccio',
        description: 'Thinly sliced prime beef tenderloin, arugula, capers, lemon, truffle oil, aged pecorino',
      },
    ],
  },
  {
    course: 'Pasta',
    items: [
      {
        name: 'Tagliatelle Bolognese',
        description: 'Fresh egg tagliatelle, slow-braised Wagyu beef and pork, Parmigiano-Reggiano',
      },
      {
        name: 'Cacio e Pepe',
        description: 'Tonnarelli pasta, Pecorino Romano, Parmigiano-Reggiano, house-cracked black pepper',
      },
      {
        name: 'Spaghetti with Clams',
        description: 'Littleneck clams, white wine, garlic, Calabrian chili, parsley, toasted breadcrumbs',
      },
    ],
  },
  {
    course: 'Mains',
    items: [
      {
        name: 'Roasted Sea Bass',
        description: 'Pan-roasted Mediterranean sea bass, olive tapenade, cherry tomato confit, caperberries',
      },
      {
        name: 'Dry-Aged Ribeye',
        description: '28-day dry-aged bone-in ribeye, rosemary-garlic butter, natural jus',
      },
      {
        name: 'Herb-Crusted Lamb',
        description: 'Rack of lamb, Sardinian fregola, spring pea purée, mint gremolata',
      },
    ],
  },
  {
    course: 'Desserts',
    items: [
      {
        name: 'Tiramisu',
        description: 'Espresso-soaked ladyfingers, mascarpone cream, Valrhona cocoa — our house classic',
      },
      {
        name: 'Chocolate Torte',
        description: 'Flourless dark chocolate cake, espresso anglaise, fleur de sel',
      },
      {
        name: 'Italian Cheese Board',
        description: 'Three seasonal Italian cheeses, honeycomb, Marcona almonds, fruit preserves',
      },
    ],
  },
];

export default function SpecialsPage() {
  return (
    <>
      {/* Page header */}
      <div className="bg-ts-charcoal py-20 text-center">
        <FadeIn immediate className="mx-auto max-w-2xl space-y-4 px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.5em] text-ts-gold">
            Tredici Social · Bronxville, NY
          </p>
          <h1 className="font-heading text-5xl font-medium text-white sm:text-6xl">
            Today&apos;s Specials
          </h1>
          <p className="text-lg leading-relaxed text-ts-light-text/70">
            Fresh from the kitchen — crafted daily around the best ingredients available.
          </p>
        </FadeIn>
      </div>

      <main className="bg-ts-cream">
        <div className="mx-auto max-w-2xl px-6 py-16 sm:px-8">
          <FadeIn className="space-y-16" delayStep={0.14}>
            {SPECIALS.map((section) => (
              <div key={section.course}>

                {/* Course heading */}
                <div className="mb-8 flex items-center gap-5">
                  <h2 className="font-heading text-3xl font-medium tracking-wide text-ts-charcoal sm:text-4xl">
                    {section.course}
                  </h2>
                  <div className="h-px flex-1 bg-ts-crimson/30" aria-hidden="true" />
                </div>

                {/* Dishes */}
                <div className="space-y-8">
                  {section.items.map((item) => (
                    <div key={item.name} className="space-y-2">
                      <p className="font-heading text-2xl font-semibold text-ts-charcoal sm:text-3xl">
                        {item.name}
                      </p>
                      <p className="text-lg leading-relaxed text-ts-muted sm:text-xl">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>

              </div>
            ))}
          </FadeIn>

        </div>
      </main>
    </>
  );
}
