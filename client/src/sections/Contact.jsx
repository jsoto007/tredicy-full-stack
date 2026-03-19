import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';

export default function Contact() {
  const { isSpanish } = useLanguage();
  const contactPoints = isSpanish
    ? [
        {
          id: 'call',
          heading: 'Telefono',
          value: '(929) 342-8062',
          body: 'Llama o envia mensaje si tienes preguntas rapidas antes de reservar.',
        },
        {
          id: 'email',
          heading: 'Correo',
          value: 'nailsmelodi@gmail.com',
          body: 'Ideal para preguntas sobre citas y solicitudes especiales.',
        },
        {
          id: 'studio',
          heading: 'Salon',
          value: '1205 College Ave, Bronx, NY 10456',
          body: 'Solo con cita previa.',
        },
      ]
    : [
        {
          id: 'call',
          heading: 'Phone',
          value: '(929) 342-8062',
          body: 'Text or call to ask quick questions before booking.',
        },
        {
          id: 'email',
          heading: 'Email',
          value: 'nailsmelodi@gmail.com',
          body: 'Best for appointment questions and special requests.',
        },
        {
          id: 'studio',
          heading: 'Studio',
          value: '1205 College Ave, Bronx, NY 10456',
          body: 'By appointment only.',
        },
      ];
  const copy = isSpanish
    ? {
        eyebrow: 'Contacto',
        title: 'Mantente conectada',
        description:
          'Escribenos antes de tu visita si necesitas ayuda para elegir un servicio, confirmar disponibilidad o compartir mas inspiracion para tu set.',
        mapLabel: 'Abrir mapa del salon Melodi Nails',
        smsLabel: 'Enviar mensaje de texto',
        emailLabel: 'Enviar correo',
        instagramLabel: 'Visitar Melodi Nails en Instagram',
      }
    : {
        eyebrow: 'Contact',
        title: 'Stay connected',
        description:
          'Reach out before your visit if you need help choosing a service, confirming availability, or sharing extra inspiration for your set.',
        mapLabel: 'Open map to Melodi Nails studio',
        smsLabel: 'Send text message',
        emailLabel: 'Send email',
        instagramLabel: 'Visit Melodi Nails on Instagram',
      };
  return (
    <section id="contact" className="bg-[#fffaf5] py-16 text-[#23301d]">
      <FadeIn className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6" delayStep={0.16}>
        <SectionTitle
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <FadeIn className="grid gap-8 md:grid-cols-3" childClassName="h-full" delayStep={0.1}>
          {contactPoints.map((item) => (
            <Card key={item.id} className="space-y-3 bg-[#fffdf9]">
              <p className="text-xs uppercase tracking-[0.3em] text-[#6f7863]">{item.heading}</p>
              {item.id === 'studio' ? (
                <address className="not-italic break-words text-sm font-semibold tracking-[0.08em] text-slate-900 sm:text-base">
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(item.value)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-4 hover:underline"
                    aria-label={copy.mapLabel}
                  >
                    {item.value}
                  </a>
                </address>
              ) : (
                item.id === 'call' ? (
                  <a
                    href={`sms:${item.value.replace(/[^0-9]/g, '')}`}
                    className="text-sm font-semibold tracking-[0.08em] text-slate-900 underline-offset-4 hover:underline sm:text-base"
                    aria-label={copy.smsLabel}
                  >
                    {item.value}
                  </a>
                ) : item.id === 'email' ? (
                  <a
                    href={`mailto:${item.value}`}
                    className="whitespace-nowrap text-sm font-semibold tracking-[0.08em] text-slate-900 underline-offset-4 hover:underline sm:text-base"
                    aria-label={copy.emailLabel}
                  >
                    {item.value}
                  </a>
                ) : (
                  <p className="break-words text-sm font-semibold tracking-[0.08em] text-slate-900 sm:text-base">
                    {item.value}
                  </p>
                )
              )}
              <p className="text-sm text-slate-700">{item.body}</p>
            </Card>
          ))}
        </FadeIn>
        <FadeIn className="flex items-center gap-4" immediate delayStep={0.2}>
          <a
            href="https://www.instagram.com/_melodinails_?igsh=dWV5Y2VoOGd2dzI2&utm_source=qr"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#c8af8f] text-xs font-semibold uppercase tracking-[0.3em] text-[#6f7863] transition hover:bg-[#f3e7d9]"
            aria-label={copy.instagramLabel}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-5 w-5"
            >
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17" cy="7" r="1.25" />
            </svg>
          </a>
          <a
            href="https://www.instagram.com/_melodinails_?igsh=dWV5Y2VoOGd2dzI2&utm_source=qr"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6f7863] underline-offset-4 hover:underline"
            aria-label={copy.instagramLabel}
          >
            instagram.com/_melodinails_
          </a>
        </FadeIn>
      </FadeIn>
    </section>
  );
}
