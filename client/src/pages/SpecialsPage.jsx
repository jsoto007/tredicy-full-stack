import FadeIn from '../components/FadeIn.jsx';

const SPECIALS = [
  {
    course: 'Appetizers',
    items: [
      {
        name: 'French Onion Soup',
        description:
          'Caramelized onions in beef and brandy broth, with brick oven bread and finished with toasted Gruyère cheese',
      },
      {
        name: 'Tuna Tartare',
        description:
          'Diced sushi grade ahi tuna mixed with soy sauce, avocado, sour cream, jalapeño and mustard seeds, served over crispy rice with black sesame seeds, lemon-lime aioli, topped with micro cilantro and wasabi oil',
      },
      {
        name: 'Steamed Mussels',
        description:
          'PEI mussels steamed with tomato, white wine, roasted garlic, extra virgin olive oil and crumbled hot sausage, served with toasted Tuscan flatbread',
      },
      {
        name: 'Fried Calamari Agro Dolce',
        description:
          'Crispy fried calamari topped with homemade sweet and sour sauce, shaved scallion and black sesame seeds',
      },
    ],
  },
  {
    course: 'Entrees',
    items: [
      {
        name: 'Spicy Chicken Parm',
        description:
          'Organic chicken breast, pounded thin, panko breaded and fried, topped with San Marzano crushed plum tomato sauce, a touch of cream, shot of vodka and shaved Calabrian chillis, with toasted mozzarella served over rigatoni',
      },
      {
        name: 'Orata',
        description:
          'Grilled filet of Mediterranean white fish served over roasted sweet creamed corn with lima beans, charred brussels sprouts and cauliflower, finished with lemon chive oil and micro cilantro',
      },
      {
        name: 'Long Island Duck',
        description:
          'Pan seared Long Island duck breast over wild mushroom risotto with caramelized onions and porcini crema, finished with frizzled shallots',
      },
      {
        name: 'Pasutice',
        description:
          'Hand cut diamond shaped pasta with steamed Maine lobster, cherry tomatoes, green and yellow zucchini, roasted garlic and scallion with a touch of cream',
      },
      {
        name: 'Braised Short Rib',
        description:
          'Bone in short rib braised with Chianti, aromatics and natural reduction, served with oven roasted Yukon gold potatoes and broccoli rabe, finished with frizzled shallots',
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
            Specials of the Day
          </h1>
          <p className="text-lg leading-relaxed text-ts-light-text/70">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
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
