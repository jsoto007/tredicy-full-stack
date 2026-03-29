function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

const variants = {
  // Deep crimson — primary action on light backgrounds
  primary:
    'bg-ts-crimson text-white hover:bg-ts-garnet shadow-crimson hover:shadow-card-hover focus-visible:ring-ts-crimson focus-visible:ring-offset-white',
  // Bright scarlet — hero/dark-bg CTA (most prominent)
  cta: 'bg-ts-scarlet text-white hover:bg-ts-crimson shadow-crimson focus-visible:ring-ts-scarlet focus-visible:ring-offset-[#1C1410]',
  // Outlined on light backgrounds
  secondary:
    'border border-ts-crimson text-ts-crimson hover:bg-ts-crimson hover:text-white focus-visible:ring-ts-crimson focus-visible:ring-offset-white',
  // Outlined on dark backgrounds
  'outline-light':
    'border border-white/50 text-white hover:border-white hover:bg-white/10 focus-visible:ring-white focus-visible:ring-offset-[#1C1410]',
  // Ghost on light
  ghost: 'text-ts-muted hover:text-ts-dark-text focus-visible:ring-ts-crimson focus-visible:ring-offset-white',
  // Warm cream — subtle on light backgrounds
  light:
    'bg-ts-linen text-ts-dark-text hover:bg-ts-stone focus-visible:ring-ts-crimson focus-visible:ring-offset-white',
  // Gold metallic accent
  gold: 'bg-ts-gold text-ts-charcoal hover:bg-ts-gold-light focus-visible:ring-ts-gold focus-visible:ring-offset-white',
};

export default function Button({
  as: Component = 'button',
  variant = 'primary',
  className = '',
  children,
  ...props
}) {
  const variantClasses = variants[variant] || variants.primary;

  return (
    <Component className={classNames(baseClasses, variantClasses, className)} {...props}>
      {children}
    </Component>
  );
}
