const DEFAULT_APPOINTMENT_TYPE_LABEL = 'Table reservation';
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

export function getReservationTypeLabel(reservation) {
  if (!reservation) {
    return DEFAULT_APPOINTMENT_TYPE_LABEL;
  }
  const sessionName = reservation.session_option?.name?.trim();
  if (sessionName) {
    return sessionName;
  }
  const serviceName = reservation.service?.name?.trim();
  if (serviceName) {
    return serviceName;
  }
  const descriptionLabel = normalizeDescription(reservation.client_description);
  if (descriptionLabel) {
    return descriptionLabel;
  }
  return DEFAULT_APPOINTMENT_TYPE_LABEL;
}

export function sanitizeReservationForConfirmation(reservation) {
  if (!reservation) {
    return null;
  }
  return {
    id: reservation.id,
    reference_code: reservation.reference_code,
    status: reservation.status,
    created_at: reservation.created_at,
    updated_at: reservation.updated_at,
    scheduled_start: reservation.scheduled_start,
    scheduled_end: reservation.scheduled_end,
    duration_minutes: reservation.duration_minutes,
    suggested_duration_minutes: reservation.suggested_duration_minutes,
    client_description: reservation.client_description,
    contact_name: reservation.contact_name || reservation.contact?.name || null,
    contact_email: reservation.contact_email || reservation.contact?.email || null,
    contact_phone: reservation.contact_phone || reservation.contact?.phone || null,
    seating_preference: reservation.seating_preference || reservation.restaurant?.placement || null,
    party_size: reservation.party_size || reservation.restaurant?.size || null,
    special_requests: reservation.special_requests || reservation.restaurant?.notes || null,
    terms_agreed_at: reservation.terms_agreed_at,
    contact: reservation.contact
      ? {
          name: reservation.contact.name || null,
          email: reservation.contact.email || null,
          phone: reservation.contact.phone || null
        }
      : null,
    restaurant: reservation.restaurant
      ? {
          placement: reservation.restaurant.placement || null,
          size: reservation.restaurant.size || null,
          notes: reservation.restaurant.notes || null
        }
      : null,
    service: reservation.service
      ? {
          name: reservation.service.name || reservation.session_option?.name || null,
          notes: reservation.service.notes || reservation.client_description || null
        }
      : null,
    session_option: reservation.session_option
      ? {
          id: reservation.session_option.id,
          name: reservation.session_option.name,
          duration_minutes: reservation.session_option.duration_minutes,
          price_cents: reservation.session_option.price_cents
        }
      : null,
    assigned_admin: reservation.assigned_admin
      ? {
          id: reservation.assigned_admin.id,
          name: reservation.assigned_admin.name || reservation.assigned_admin.display_name || null,
          display_name: reservation.assigned_admin.display_name || null,
          email: reservation.assigned_admin.email || null,
          contact_email: reservation.assigned_admin.contact_email || null
        }
      : null,
    payments: Array.isArray(reservation.payments)
      ? reservation.payments.map((payment) => ({
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
    client: reservation.client
      ? {
          id: reservation.client.id,
          display_name: reservation.client.display_name,
          email: reservation.client.email,
          phone: reservation.client.phone,
          is_guest: reservation.client.is_guest,
          role: reservation.client.role
        }
      : reservation.client || null
  };
}
