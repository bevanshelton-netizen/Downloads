'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './open-africa.module.css';

const programmes = [
  {
    title: 'Africa Creates',
    country: 'Across Africa',
    category: 'Creativity & Culture',
    duration: '1 min',
    creator: 'Wiki In Africa / Rachel Zadok',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Wiki_Loves_Africa_2024_%22Africa_Creates%22_Theme_Video.webm',
    videoUrl: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Wiki_Loves_Africa_2024_%22Africa_Creates%22_Theme_Video.webm',
    description: 'A vibrant celebration of African makers, imagination and cultural creativity.',
    tone: 'gold',
  },
  {
    title: 'Traditional South African Dance',
    country: 'South Africa',
    category: 'Dance & Heritage',
    duration: '1 min',
    creator: 'ThierryTuyishimeTV',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Beautiful_Traditional_South_African_Dance!.webm',
    videoUrl: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Beautiful_Traditional_South_African_Dance!.webm',
    description: 'Movement, rhythm and shared celebration captured in a joyful performance.',
    tone: 'coral',
  },
  {
    title: 'Calabash Rhythms of Cameroon',
    country: 'Cameroon',
    category: 'Music & Community',
    duration: '9 min',
    creator: 'zorks3',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Local_Cameroonian_Music_with_Calabash_Instruments.webm',
    videoUrl: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Local_Cameroonian_Music_with_Calabash_Instruments.webm',
    description: 'Traditional-style community music performed with calabash instruments.',
    tone: 'green',
  },
  {
    title: 'African Traditional Music',
    country: 'Africa',
    category: 'Music & Heritage',
    duration: 'Feature',
    creator: 'twinfoto',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:African_traditional_music.webm',
    videoUrl: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/African_traditional_music.webm',
    description: 'An open-licence window into the sound, instruments and energy of African music.',
    tone: 'blue',
  },
  {
    title: 'Aje Kogba',
    country: 'Nigeria',
    category: 'Yoruba Short Film & Storytelling',
    duration: '11 min',
    creator: 'Yoruba Wikimedians User Group; produced and directed by Tunde Oladimeji',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Aje_kogba.webm',
    videoUrl: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Aje_kogba.webm',
    description: 'A Yoruba didactic story about navigating life’s challenges and adversaries.',
    tone: 'green',
  },
  {
    title: 'Itan Ore Meji',
    country: 'Nigeria',
    category: 'Yoruba Short Film & Storytelling',
    duration: 'Short film',
    creator: 'Yoruba Wikimedians User Group',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Itan_Ore_meji_(Ase-sile,_Abo_waba).webm',
    videoUrl: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Itan_Ore_meji_(Ase-sile,_Abo_waba).webm',
    description: 'A Yoruba oral-storytelling film preserving language, wisdom and community memory.',
    tone: 'gold',
  },
] as const;

export default function OpenAfrica() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = programmes[selectedIndex];

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>KORA OPEN AFRICA • WATCH FREE</div>
          <h1>Free African entertainment.<span>Built in Africa. For the world.</span></h1>
          <p>A living showcase of African music, movement, heritage and creativity—open to every viewer and built to help creators travel further.</p>
          <div className={styles.actions}>
            <a className={styles.primary} href="#watch-now">Watch free now →</a>
            <Link className={styles.secondary} href="/creators">Put your work on KORA</Link>
            <Link className={styles.secondary} href="/advertise">Sponsor this channel</Link>
          </div>
        </div>
        <div className={styles.heroBadge} aria-hidden="true"><b>FREE</b><span>AFRICAN</span><strong>TV</strong></div>
      </section>

      <div className={styles.marketingRail}>
        <span>EVERY PLAY BUILDS DISCOVERY</span><i>◆</i><span>EVERY SPONSOR FUNDS CREATORS</span><i>◆</i><span>EVERY SHARE TAKES AFRICA FURTHER</span>
      </div>

      <section className={styles.watch} id="watch-now">
        <header className={styles.sectionHead}>
          <div><div className={styles.eyebrow}>NOW PLAYING</div><h2>{selected.title}</h2></div>
          <p>{selected.description}</p>
        </header>

        <div className={styles.playerFrame}>
          <div className={styles.playerTop}><span /><span /><span /><b>KORA OPEN AFRICA</b></div>
          <video key={selected.videoUrl} className={styles.video} controls playsInline preload="metadata">
            <source src={selected.videoUrl} type="video/webm" />
            Your browser does not support this video.
          </video>
          <div className={styles.creditBar}>
            <div><strong>{selected.creator}</strong><span>{selected.country} • {selected.category} • {selected.duration}</span></div>
            <div><a href={selected.licenseUrl} target="_blank" rel="noreferrer">{selected.license}</a><a href={selected.sourcePage} target="_blank" rel="noreferrer">Original source ↗</a></div>
          </div>
        </div>
      </section>

      <section className={styles.catalogue}>
        <header className={styles.catalogueHead}><div><div className={styles.eyebrow}>KORA SHORT FILMS + THE OPEN COLLECTION</div><h2>Watch African stories, music and culture free.</h2></div><span>{programmes.length} launch selections • More added as rights are verified</span></header>
        <div className={styles.grid}>
          {programmes.map((programme, index) => (
            <button className={[styles.card, styles[programme.tone], index === selectedIndex ? styles.active : ''].join(' ')} key={programme.title} onClick={() => { setSelectedIndex(index); document.getElementById('watch-now')?.scrollIntoView({ behavior: 'smooth' }); }}>
              <span className={styles.play}>▶</span>
              <small>{programme.country} • {programme.license}</small>
              <strong>{programme.title}</strong>
              <p>{programme.description}</p>
              <b>Play on KORA →</b>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.growth}>
        <article>
          <div className={styles.eyebrow}>CREATORS</div>
          <h2>Your work deserves a bigger screen.</h2>
          <p>Join KORA&apos;s founding creator network, retain your rights and reach audiences across Africa and the world.</p>
          <Link href="/creators">Bring your content →</Link>
        </article>
        <article>
          <div className={styles.eyebrow}>FOUNDING BRAND PARTNERS</div>
          <h2>Put your brand behind African discovery.</h2>
          <p>Sponsor KORA Open Africa, a genre collection or a creator season in a family-safe environment.</p>
          <Link href="/advertise">Sponsor the channel →</Link>
        </article>
      </section>

      <section className={styles.licenceNote}>
        <strong>Open, credited and rights-aware.</strong>
        <p>KORA Open Africa uses public-domain and commercially reusable open-licence works with visible attribution. Inclusion does not imply creator endorsement of KORA or its sponsors. Content is reviewed before publication and may be removed if rights information changes.</p>
      </section>
    </main>
  );
}
