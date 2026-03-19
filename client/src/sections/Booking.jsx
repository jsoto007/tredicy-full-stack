import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import FadeIn from '../components/FadeIn.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';

export default function Booking() {
  const navigate = useNavigate();
  const { isSpanish } = useLanguage();
  const bookingRequirements = isSpanish
    ? [
        'Ingresa tu informacion de contacto',
        'Elige un servicio de unas y un horario disponible',
        'Agrega notas opcionales o una imagen de inspiracion, luego paga el deposito o el monto completo',
      ]
    : [
        'Enter your contact information',
        'Choose a nail service and available time slot',
        'Add optional notes or an inspiration image, then pay the deposit or full amount',
      ];
  const copy = isSpanish
    ? {
        eyebrow: 'Reservas',
        title: 'Reserva tu cita',
        description: 'Elige un servicio, selecciona un horario y paga de forma segura con Stripe.',
        detail:
          'Aceptamos reservas como invitada. Puedes agregar notas o una foto de inspiracion y luego pagar el deposito o el monto completo.',
        cta: 'Comenzar reserva',
      }
    : {
        eyebrow: 'Booking',
        title: 'Reserve your appointment',
        description: 'Choose a nail service, pick a time that fits your schedule, and check out securely with Stripe.',
        detail:
          'Guest checkout is supported. Add notes or an inspiration image if you want, then pay the deposit or the full amount.',
        cta: 'Start Booking',
      };
  const requirementList = useMemo(
    () =>
      bookingRequirements.map((item, index) => (
        <li key={item} className="group flex items-start gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2a3923] text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(42,57,35,0.55)] transition duration-200 group-hover:-translate-x-[2px] group-hover:-translate-y-[2px]">
            {index + 1}
          </span>
          <span className="pt-2 text-xs font-semibold uppercase leading-relaxed tracking-[0.25em] text-[#32412a]">
            {item}
          </span>
        </li>
      )),
    [bookingRequirements]
  );

  return (
    <section
      id="booking"
      className="bg-[#ECE7E2] py-20 text-[#23301d]"
    >
      <FadeIn className="mx-auto max-w-6xl space-y-10 px-6" delayStep={0.18}>
        <div className="space-y-4 md:max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#6f7863]">
            {copy.eyebrow}
          </p>
          <h2 className="text-4xl font-semibold leading-[1.05] tracking-[0.06em] text-[#2a3923] sm:text-5xl">
            {copy.title}
          </h2>
          <p className="text-base leading-relaxed text-[#5e6755]">
            {copy.description}
          </p>
        </div>

        <Card className="relative overflow-hidden bg-[#fffdf9] px-8 py-10 transition duration-300 sm:p-10">
          <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-start">
            <div className="space-y-6">
              <p className="border-b-2 border-[#dbc9b4] pb-6 text-base leading-relaxed text-[#4f5847]">
                {copy.detail}
              </p>
              <ul className="space-y-4">{requirementList}</ul>
            </div>
            <div className="flex items-center md:justify-end">
              <Button type="button" onClick={() => navigate('/appointments/new')} className="w-full px-10 py-4 md:w-auto">
                {copy.cta}
              </Button>
            </div>
          </div>
        </Card>
      </FadeIn>
    </section>
  );
}
