export const DEFAULT_NAV_ITEMS = [
  { label: 'Work', to: '/#work', type: 'link' },
  { label: 'Services', to: '/#services', type: 'link' },
  { label: 'About', to: '/#about', type: 'link' },
  { label: 'Contact', to: '/#contact', type: 'link' }
];

export const USER_NAV_ITEMS = [
  { label: 'Dashboard', to: '/portal/dashboard', type: 'link', end: true },
  { label: 'Appointments', to: '/portal/appointments', type: 'link' },
  { label: 'Profile', to: '/portal/profile', type: 'link' }
];

export const ADMIN_NAV_ITEMS = [
  { label: 'Settings', to: '/dashboard/admin/settings', type: 'link' },
  { label: 'Calendar', to: '/dashboard/admin/calendar', type: 'link' },
  { label: 'Gallery', to: '/dashboard/admin/gallery', type: 'link' }
];
