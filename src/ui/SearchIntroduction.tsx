import content from '../content/search.json';

export function SearchIntroduction(){
 return <section className="site-intro" aria-labelledby="site-intro-title">
  <h2 id="site-intro-title">{content.heading}</h2>
  <p>{content.description}</p><p>{content.detail}</p>
  <nav aria-label="훈련 안내">{content.links.map(link=><a key={link.href} href={link.href}>{link.label}</a>)}</nav>
 </section>;
}
