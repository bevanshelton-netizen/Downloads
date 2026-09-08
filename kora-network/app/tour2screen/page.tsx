import Link from 'next/link';

const revenue = [
  ['Tour Diaries','Turn each city into an episode.'],
  ['Concert Films','Premiere, premium or pay-per-view.'],
  ['Backstage Access','Give fans the story behind the stage.'],
  ['Sponsor Inventory','Create branded moments without ruining the art.'],
  ['Ticket + Stream','Bundle physical attendance with online/replay access.'],
  ['Post-Tour Film','Turn the whole road story into a documentary.'],
];

const paths = [
  ['LAUNCH','Make your first tour your origin story.'],
  ['GROW','Turn every stop into audience, content and sponsor value.'],
  ['REVIVE','Bring a legacy catalogue and fanbase back to the screen.'],
  ['RELAUNCH','Build a comeback campaign around the road, the music and the return.'],
];

export default function Tour2Screen() {
  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">KORA TOUR2SCREEN™ • TOUR ONCE • EARN MORE THAN ONCE</div>
        <h1>Don&apos;t just tour.<br/><span>Document the journey.</span></h1>
        <p>
          Your tour is already a story. KORA helps musicians and bands turn the road into protected,
          monetisable films, episodes, concert streams, sponsor inventory and an evergreen post-tour catalogue.
        </p>
        <div className="actions">
          <Link className="primary" href="/studio">Open Creator Studio</Link>
          <Link className="secondary" href="/perform-live">Bring a live show to KORA</Link>
        </div>
      </section>

      <section>
        <div className="sectionHead">
          <div><div className="eyebrow">ONE TOUR • MANY ASSETS</div><h2>The show is only one part of the value.</h2></div>
        </div>
        <div className="grid three">
          {revenue.map(([title,copy]) => <article className="panel" key={title}><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>

      <section>
        <div className="sectionHead"><div><div className="eyebrow">CAREER ENGINE</div><h2>Launch. Grow. Revive. Relaunch.</h2></div></div>
        <div className="grid two">
          {paths.map(([title,copy]) => <article className="panel" key={title}><div className="eyebrow">{title}</div><h3>{copy}</h3></article>)}
        </div>
      </section>

      <section className="panel">
        <div className="eyebrow">THE KORA ROAD RULE</div>
        <h2>Capture with permission. Own the footage. Clear the music. Keep the evidence.</h2>
        <p>
          Tour2Screen tracks venue/promoter permissions, performer releases, music/master rights, guest artists,
          sponsor approvals, audience notices and third-party footage before commercial publication.
        </p>
        <div className="actions"><Link className="primary" href="/studio/productions/new">Start a production</Link><Link className="secondary" href="/legal/creator-agreement">Read creator rights terms</Link></div>
      </section>
    </main>
  );
}
