import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';

export default function FAQ() {
  const { isSpanish } = useLanguage();
  const faqs = isSpanish
    ? [
        {
          id: 'faq-1',
          question: 'Necesito una cuenta para reservar?',
          answer:
            'No. Puedes reservar como invitada con tu nombre, apellido, correo, telefono, servicio seleccionado y metodo de pago.',
        },
        {
          id: 'faq-2',
          question: 'Puedo llevar fotos de inspiracion?',
          answer:
            'Si. Puedes subir una imagen durante la reserva y tambien dejar notas opcionales para que la tecnica conozca el estilo que buscas.',
        },
        {
          id: 'faq-3',
          question: 'Como funciona el pago?',
          answer:
            'Al finalizar puedes pagar el porcentaje de deposito configurado por la administracion o el monto total del servicio. Stripe procesa el pago de forma segura antes de confirmar tu cita.',
        },
      ]
    : [
        {
          id: 'faq-1',
          question: 'Do I need an account to book?',
          answer:
            'No. You can book as a guest with your first name, last name, email, phone number, selected service, and payment choice.',
        },
        {
          id: 'faq-2',
          question: 'Can I bring inspiration photos?',
          answer:
            'Yes. You can upload an inspiration image during booking, and you can also leave optional notes so the nail tech knows the look you want.',
        },
        {
          id: 'faq-3',
          question: 'How does payment work?',
          answer:
            'At checkout you can pay the admin-set deposit percentage or the full service amount. Stripe securely handles payment before your appointment is confirmed.',
        },
      ];
  const copy = isSpanish
    ? {
        eyebrow: 'Preguntas',
        title: 'Antes de tu visita',
        description:
          'Tres respuestas rapidas sobre reservas, fotos de inspiracion y como funciona el pago en la nueva experiencia de citas.',
      }
    : {
        eyebrow: 'FAQ',
        title: 'Before you visit',
        description:
          'Three quick answers for booking, inspiration photos, and how payment works with the new nails appointment flow.',
      };
  return (
    <section id="faq" className="bg-[#ECE7E2] py-16 text-[#23301d]">
      <FadeIn className="mx-auto flex max-w-6xl flex-col gap-12 px-6" delayStep={0.18}>
        <SectionTitle
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <FadeIn className="space-y-6" delayStep={0.12}>
          {faqs.map((faq) => (
            <Card key={faq.id} className="space-y-3">
              <h3 className="text-base font-semibold tracking-[0.08em] text-[#2a3923]">{faq.question}</h3>
              <p className="text-sm text-[#5e6755]">{faq.answer}</p>
            </Card>
          ))}
        </FadeIn>
      </FadeIn>
    </section>
  );
}
