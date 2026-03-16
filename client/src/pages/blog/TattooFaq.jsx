export default function TattooFaq() {
  return (
    <article className="space-y-10 text-base leading-relaxed text-gray-600">
      <header>
        <p className="tracking-[0.3em] text-xs font-semibold uppercase text-gray-500">FAQ</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-gray-900">
          Frequently Asked Questions
        </h1>
        <p className="mt-4 max-w-3xl">
          Thinking about your next tattoo or caring for a fresh piece? These are the questions we hear the most in the
          studio. If you do not see your question answered here, send us a note&mdash;we are always happy to help.
        </p>
      </header>

      <section className="space-y-6">
        <Question
          question="How long does a tattoo take to heal?"
          answer="Every body heals at its own pace, but most tattoos look settled within 2–3 weeks. During that time the skin will go through stages of redness, tenderness, flaking, and light peeling. Keep the area clean, moisturized, and out of direct sunlight to support a smooth recovery."
        />
        <Question
          question="When should I schedule a touch-up?"
          answer="If you notice any patchy areas or fading spots once the tattoo has fully healed, reach out so we can evaluate it together. Touch-ups are usually scheduled after the 8-week mark to ensure your skin is ready for more ink."
        />
        <Question
          question="What can I do to minimize pain or irritation?"
          answer="Arrive well-rested, hydrated, and after a full meal. Avoid alcohol, aspirin, and blood thinners the day before and day of your appointment. During the session, focus on slow breathing and let us know if you need breaks—we will pace the session around you."
        />
        <Question
          question="How should I prepare before my tattoo appointment?"
          answer="Moisturize the area for a few days beforehand and gently exfoliate 24 hours prior so the skin is soft and ready. Wear comfortable clothing that allows easy access to the placement. Bring reference images and any questions you may have—we love collaborating."
        />
      </section>

      <footer>
        <p>
          Still curious about something? Email us at{' '}
          <a className="font-medium text-black underline" href="mailto:artem@blackworknyc.com">
            artem@blackworknyc.com
          </a>{' '}
          and we will get back to you soon.
        </p>
      </footer>
    </article>
  );
}

function Question({ question, answer }) {
  return (
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold text-gray-900">{question}</h2>
      <p>{answer}</p>
    </div>
  );
}
