export const DEFAULT_NAV_ITEMS = [
  { label: 'Gallery', to: '/#work', type: 'link' },
  { label: 'Menu', to: '/#services', type: 'link' },
  { label: 'About', to: '/#about', type: 'link' },
  { label: 'Contact', to: '/#contact', type: 'link' }
];

export const USER_NAV_ITEMS = [
  { label: 'Dashboard', to: '/portal/dashboard', type: 'link', end: true },
  { label: 'Reservations', to: '/portal/reservations', type: 'link' },
  { label: 'Profile', to: '/portal/profile', type: 'link' }
];

export const ADMIN_NAV_ITEMS = [
  { label: 'Calendar', to: '/dashboard/admin/calendar', type: 'link' },
  { label: 'Gallery', to: '/dashboard/admin/gallery', type: 'link' },
  { label: 'Menu', to: '/dashboard/admin/menu', type: 'link' },
  { label: 'Specials', to: '/dashboard/admin/specials', type: 'link' },
];
