export default function TattooAftercare() {
  return (
    <article className="space-y-10 text-base leading-relaxed text-gray-600">
      <header>
        <p className="tracking-[0.3em] text-xs font-semibold uppercase text-gray-500">
          Aftercare
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-gray-900">
          Tattoo Aftercare Guide
        </h1>
        <p className="mt-4 text-base text-gray-600">
          When you&rsquo;ve just received your tattoo, proper care is essential for healing and maintaining the
          artwork&rsquo;s quality. The first few weeks set the stage for how your tattoo will look for years to come,
          so take these steps seriously and reach out if anything feels off.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">Daily Care Instructions</h2>
        <p>Follow these guidelines carefully during the initial healing stages:</p>
        <ol className="list-decimal space-y-3 pl-6">
          <li className="pl-1">
            Avoid direct sunlight for the first few days. UV exposure can irritate fresh ink and slow healing.
          </li>
          <li className="pl-1">
            Keep the adhesive plastic bandage on for 3–4 days to protect the area from bacteria and friction.
          </li>
          <li className="pl-1">
            Remove the bandage during a shower and gently wash the tattoo using an unscented antibacterial soap. Use
            lukewarm water and your fingertips&mdash;no washcloths or loofahs.
          </li>
          <li className="pl-1">
            Pat dry with a clean, soft towel. About five minutes after washing, apply a thin layer of Aquaphor,
            Bepanthen, or Cetaphil to lock in moisture. A little goes a long way.
          </li>
          <li className="pl-1">
            Avoid soaking your tattoo in any body of water&mdash;no bathtubs, pools, saunas, or the ocean. Regular warm
            showers are fine.
          </li>
          <li className="pl-1">
            Keep the area clean and moisturized for the full healing period. Wash the area and apply a healing cream 3–4
            times daily.
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">What to Expect While Healing</h2>
        <p>
          The healing process typically takes 2–3 weeks. During this time, you may notice redness, slight swelling,
          scabbing, and a bit of flaking&mdash;all normal signs that your skin is repairing itself. Do not pick or
          scratch at any flakes or scabs; disrupting them can lead to color loss or scarring.
        </p>
        <p>
          Wear loose, breathable clothing over the tattoo, sleep on fresh sheets, and avoid intense workouts that cause
          heavy sweating for the first few days. If you must be outdoors, keep the tattoo covered and wait until it is
          fully healed before applying sunscreen.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">Recommended Products</h2>
        <ul className="space-y-3">
          <li className="flex flex-col gap-1">
            <a href="https://a.co/d/at49ZEE" target="_blank" rel="noopener noreferrer">
              Aquaphor Healing Ointment
            </a>{' '}
            &ndash; a lightweight ointment that keeps the skin protected without smothering it.
          </li>
          <li className="flex flex-col gap-1">
            <a href="https://a.co/d/2RS7d8U" target="_blank" rel="noopener noreferrer">
              Bepanthen
            </a>{' '}
            &ndash; a soothing cream that hydrates freshly tattooed skin.
          </li>
          <li className="flex flex-col gap-1">
            <a href="https://a.co/d/6sZaOqm" target="_blank" rel="noopener noreferrer">
              Cetaphil Moisturizing Lotion
            </a>{' '}
            &ndash; an unscented option ideal for sensitive skin types.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">When to Reach Out</h2>
        <p>
          If at any point the area becomes excessively swollen, hot to the touch, or produces unusual discharge, contact
          your artist right away. We&rsquo;re here to help you through the full healing process. Email us any time at{' '}
          <a href="mailto:artem@blackworknyc.com">artem@blackworknyc.com</a>.
        </p>
      </section>
    </article>
  );
}
