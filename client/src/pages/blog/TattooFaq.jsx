export default function TattooFaq() {
  return (
    <article className="space-y-10 text-base leading-relaxed text-gray-600">
      <header>
        <p className="tracking-[0.3em] text-xs font-semibold uppercase text-gray-500">FAQ</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-gray-900">
          Nail Salon Frequently Asked Questions
        </h1>
        <p className="mt-4 max-w-3xl">
          These are some of the questions clients ask most often before booking with Melodi Nails. They cover timing,
          prep, maintenance, and what to expect when visiting the studio.
        </p>
      </header>

      <section className="space-y-6">
        <Question
          question="How long will my nail service last?"
          answer="That depends on the service and your lifestyle. Natural manicures, gel polish, and acrylic sets all wear differently, but many clients return within two to three weeks to keep everything looking clean and balanced."
        />
        <Question
          question="When should I book a fill, refresh, or repair?"
          answer="If you wear acrylics or structured sets, do not wait until multiple nails are lifting or breaking. Booking maintenance before the set becomes unstable usually gives you a cleaner result and helps protect the natural nail underneath."
        />
        <Question
          question="What should I do before my appointment?"
          answer="Bring inspiration photos if you have a specific look in mind, and mention soak-off, removals, repairs, or detailed nail art when booking. That helps make sure enough time is reserved for your appointment."
        />
        <Question
          question="Do you work by appointment only?"
          answer="Yes. Appointments allow enough time for proper prep, shaping, service selection, and finishing details without rushing the process. Booking ahead is also the best way to secure your preferred day and time."
        />
        <Question
          question="Can I bring an inspiration photo?"
          answer="Yes. Inspiration photos are helpful for color direction, shape, finish, and nail art ideas. The final set may be adjusted to suit your nail length, condition, and the service you booked, but reference images make collaboration much easier."
        />
        <Question
          question="What if I need removal or a full soak-off?"
          answer="It is best to mention that before your appointment starts. Removal takes extra time, and adding it in advance helps avoid rushing the prep work for your new set."
        />
      </section>

      <footer>
        <p>
          Still curious about something? Email us at{' '}
          <a className="font-medium text-black underline" href="mailto:nailsmelodi@gmail.com">
            nailsmelodi@gmail.com
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
