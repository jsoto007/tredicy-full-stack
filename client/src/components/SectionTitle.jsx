function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function SectionTitle({
  eyebrow,
  title,
  description,
  align = 'left',
  light = false,
}) {
  const alignment = align === 'center' ? 'text-center items-center' : 'text-left items-start';
  const wrapper = align === 'center' ? 'mx-auto' : '';

  return (
    <div className={classNames('flex max-w-3xl flex-col gap-3', wrapper, alignment)}>
      {eyebrow ? (
        <p
          className={classNames(
            'text-[11px] font-semibold uppercase tracking-[0.4em]',
            light ? 'text-ts-gold' : 'text-ts-crimson'
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={classNames(
          'font-heading text-3xl font-medium sm:text-4xl',
          light ? 'text-white' : 'text-ts-charcoal'
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={classNames(
            'mt-1 text-sm leading-relaxed',
            light ? 'text-ts-light-text/80' : 'text-ts-muted'
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
