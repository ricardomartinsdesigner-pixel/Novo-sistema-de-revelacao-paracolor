export default function LegalContent({ title, updated, sections }) {
  return (
    <div className="container-x max-w-3xl py-16">
      <p className="eyebrow">Institucional</p>
      <h1 className="mt-2 text-4xl">{title}</h1>
      <p className="mt-2 text-xs text-muted-foreground">Última atualização: {updated}</p>
      <div className="mt-8 space-y-6">
        {sections.map((section) => (
          <section key={section.heading} id={section.id} className="scroll-mt-24">
            <h2 className="text-xl">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}