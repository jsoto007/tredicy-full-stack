function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function SectionTitle({ eyebrow, title, description, align = 'left' }) {
  const alignment = align === 'center' ? 'text-center' : 'text-left';
  const wrapper = align === 'center' ? 'mx-auto' : '';

  return (
    <div className={classNames('max-w-3xl', wrapper, alignment)}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#6f7863]">{eyebrow}</p>
      ) : null}
      <h2 className="mt-4 text-3xl font-semibold tracking-[0.06em] text-[#2a3923] sm:text-4xl">{title}</h2>
      {description ? <p className="mt-4 text-sm text-[#5e6755]">{description}</p> : null}
    </div>
  );
}
