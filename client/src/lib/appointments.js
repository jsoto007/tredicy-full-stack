const DEFAULT_APPOINTMENT_TYPE_LABEL = 'Nail appointment';
const MAX_LABEL_LENGTH = 60;

function normalizeDescription(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const firstLine = trimmed.split(/\r?\n/)[0].trim();
  if (!firstLine) {
    return '';
  }
  const singleSpaced = firstLine.replace(/\s+/g, ' ');
  if (singleSpaced.length <= MAX_LABEL_LENGTH) {
    return singleSpaced;
  }
  return `${singleSpaced.slice(0, MAX_LABEL_LENGTH - 3).trim()}...`;
}

export function getAppointmentTypeLabel(appointment) {
  if (!appointment) {
    return DEFAULT_APPOINTMENT_TYPE_LABEL;
  }
  const sessionName = appointment.session_option?.name?.trim();
  if (sessionName) {
    return sessionName;
  }
  const serviceName = appointment.service?.name?.trim();
  if (serviceName) {
    return serviceName;
  }
  const descriptionLabel = normalizeDescription(appointment.client_description);
  if (descriptionLabel) {
    return descriptionLabel;
  }
  return DEFAULT_APPOINTMENT_TYPE_LABEL;
}

export function sanitizeAppointmentForConfirmation(appointment) {
  if (!appointment) {
    return null;
  }
  return {
    id: appointment.id,
    reference_code: appointment.reference_code,
    status: appointment.status,
    created_at: appointment.created_at,
    updated_at: appointment.updated_at,
    scheduled_start: appointment.scheduled_start,
    scheduled_end: appointment.scheduled_end,
    duration_minutes: appointment.duration_minutes,
    suggested_duration_minutes: appointment.suggested_duration_minutes,
    client_description: appointment.client_description,
    contact_name: appointment.contact_name || appointment.contact?.name || null,
    contact_email: appointment.contact_email || appointment.contact?.email || null,
    contact_phone: appointment.contact_phone || appointment.contact?.phone || null,
    tattoo_placement: appointment.tattoo_placement || appointment.tattoo?.placement || null,
    tattoo_size: appointment.tattoo_size || appointment.tattoo?.size || null,
    placement_notes: appointment.placement_notes || appointment.tattoo?.notes || null,
    terms_agreed_at: appointment.terms_agreed_at,
    contact: appointment.contact
      ? {
          name: appointment.contact.name || null,
          email: appointment.contact.email || null,
          phone: appointment.contact.phone || null
        }
      : null,
    tattoo: appointment.tattoo
      ? {
          placement: appointment.tattoo.placement || null,
          size: appointment.tattoo.size || null,
          notes: appointment.tattoo.notes || null
        }
      : null,
    service: appointment.service
      ? {
          name: appointment.service.name || appointment.session_option?.name || null,
          notes: appointment.service.notes || appointment.client_description || null
        }
      : null,
    session_option: appointment.session_option
      ? {
          id: appointment.session_option.id,
          name: appointment.session_option.name,
          duration_minutes: appointment.session_option.duration_minutes,
          price_cents: appointment.session_option.price_cents
        }
      : null,
    assigned_admin: appointment.assigned_admin
      ? {
          id: appointment.assigned_admin.id,
          name: appointment.assigned_admin.name || appointment.assigned_admin.display_name || null,
          display_name: appointment.assigned_admin.display_name || null,
          email: appointment.assigned_admin.email || null,
          contact_email: appointment.assigned_admin.contact_email || null
        }
      : null,
    payments: Array.isArray(appointment.payments)
      ? appointment.payments.map((payment) => ({
          id: payment.id,
          provider: payment.provider,
          status: payment.status,
          amount_cents: payment.amount_cents,
          currency: payment.currency,
          receipt_url: payment.receipt_url,
          note: payment.note,
          created_at: payment.created_at
        }))
      : [],
    client: appointment.client
      ? {
          id: appointment.client.id,
          display_name: appointment.client.display_name,
          email: appointment.client.email,
          phone: appointment.client.phone,
          is_guest: appointment.client.is_guest,
          role: appointment.client.role
        }
      : appointment.client || null
  };
}
