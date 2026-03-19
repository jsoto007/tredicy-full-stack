import { useLanguage } from '../../contexts/LanguageContext.jsx';

export default function TattooFaq() {
  const { isSpanish } = useLanguage();
  const copy = isSpanish
    ? {
        title: 'Preguntas Frecuentes del Salon',
        intro:
          'Estas son algunas de las preguntas que recibimos con mas frecuencia antes de reservar en Melodi Nails. Cubren tiempos, preparacion, mantenimiento y lo que puedes esperar al visitar el estudio.',
        questions: [
          {
            question: 'Cuanto dura mi servicio de unas?',
            answer:
              'Depende del servicio y de tu rutina diaria. Manicures naturales, gel y sets acrilicos tienen desgastes distintos, pero muchas clientas regresan entre dos y tres semanas para mantener un resultado limpio y equilibrado.',
          },
          {
            question: 'Cuando debo reservar relleno, retoque o reparacion?',
            answer:
              'Si usas acrilico o sets estructurados, no esperes a que varias unas ya esten levantadas o rotas. Reservar mantenimiento antes de que el set se desestabilice suele dar un resultado mas limpio y protege mejor la una natural.',
          },
          {
            question: 'Que debo hacer antes de mi cita?',
            answer:
              'Trae fotos de inspiracion si tienes un estilo especifico en mente y avisa si necesitas retiro, soak-off, reparaciones o nail art detallado. Eso ayuda a reservar el tiempo correcto para tu cita.',
          },
          {
            question: 'Trabajan solo con cita?',
            answer:
              'Si. Las citas permiten dedicar el tiempo suficiente para preparacion, forma, seleccion del servicio y detalles finales sin apresurar el proceso.',
          },
          {
            question: 'Puedo llevar una foto de inspiracion?',
            answer:
              'Si. Las fotos ayudan con color, forma, acabado e ideas de nail art. El set final puede ajustarse segun el largo, condicion de la una y servicio reservado, pero sirven mucho para colaborar mejor.',
          },
          {
            question: 'Y si necesito retiro o soak-off completo?',
            answer:
              'Lo mejor es avisarlo antes de empezar la cita. El retiro toma tiempo adicional y mencionarlo desde el inicio ayuda a no apresurar la preparacion del nuevo set.',
          },
        ],
        footer: 'Todavia tienes dudas? Escribenos a',
      }
    : {
        title: 'Nail Salon Frequently Asked Questions',
        intro:
          'These are some of the questions clients ask most often before booking with Melodi Nails. They cover timing, prep, maintenance, and what to expect when visiting the studio.',
        questions: [
          {
            question: 'How long will my nail service last?',
            answer:
              'That depends on the service and your lifestyle. Natural manicures, gel polish, and acrylic sets all wear differently, but many clients return within two to three weeks to keep everything looking clean and balanced.',
          },
          {
            question: 'When should I book a fill, refresh, or repair?',
            answer:
              'If you wear acrylics or structured sets, do not wait until multiple nails are lifting or breaking. Booking maintenance before the set becomes unstable usually gives you a cleaner result and helps protect the natural nail underneath.',
          },
          {
            question: 'What should I do before my appointment?',
            answer:
              'Bring inspiration photos if you have a specific look in mind, and mention soak-off, removals, repairs, or detailed nail art when booking. That helps make sure enough time is reserved for your appointment.',
          },
          {
            question: 'Do you work by appointment only?',
            answer:
              'Yes. Appointments allow enough time for proper prep, shaping, service selection, and finishing details without rushing the process. Booking ahead is also the best way to secure your preferred day and time.',
          },
          {
            question: 'Can I bring an inspiration photo?',
            answer:
              'Yes. Inspiration photos are helpful for color direction, shape, finish, and nail art ideas. The final set may be adjusted to suit your nail length, condition, and the service you booked, but reference images make collaboration much easier.',
          },
          {
            question: 'What if I need removal or a full soak-off?',
            answer:
              'It is best to mention that before your appointment starts. Removal takes extra time, and adding it in advance helps avoid rushing the prep work for your new set.',
          },
        ],
        footer: 'Still curious about something? Email us at',
      };
  return (
    <article className="space-y-10 text-base leading-relaxed text-gray-600">
      <header>
        <p className="tracking-[0.3em] text-xs font-semibold uppercase text-gray-500">FAQ</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-gray-900">
          {copy.title}
        </h1>
        <p className="mt-4 max-w-3xl">
          {copy.intro}
        </p>
      </header>

      <section className="space-y-6">
        {copy.questions.map((item) => (
          <Question key={item.question} question={item.question} answer={item.answer} />
        ))}
      </section>

      <footer>
        <p>
          {copy.footer}{' '}
          <a className="font-medium text-black underline" href="mailto:nailsmelodi@gmail.com">
            nailsmelodi@gmail.com
          </a>{' '}
          {isSpanish ? 'y te responderemos pronto.' : 'and we will get back to you soon.'}
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
