import Link from 'next/link';

type Section = { title: string; body: string; bullets?: string[] };

type MarketingPageProps = {
  eyebrow: string;
  title: string;
  lead: string;
  sections: Section[];
  cta?: { title: string; body: string; label: string; href: string };
};

export function MarketingPage({ eyebrow, title, lead, sections, cta }: MarketingPageProps) {
  return (
    <main className="marketingPage">
      <section className="marketingHero">
        <div className="marketingHeroInner">
          <p className="marketingEyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="marketingLead">{lead}</p>
        </div>
      </section>
      <div className="marketingContent">
        {sections.map((section) => (
          <section className="marketingSection" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
            {section.bullets?.length ? (
              <ul className="marketingList">{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>
            ) : null}
          </section>
        ))}
        {cta ? (
          <section className="marketingCta">
            <div><h2>{cta.title}</h2><p>{cta.body}</p></div>
            <Link className="marketingButton" href={cta.href}>{cta.label}</Link>
          </section>
        ) : null}
      </div>
    </main>
  );
}
