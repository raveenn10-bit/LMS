'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Expand, Images, X } from 'lucide-react';
import gsap from 'gsap';

const posters = [
  { src: '/lavindu-class-poster-01.jpeg', kicker: 'Grades 6–11', title: 'Mathematics, made clear.', note: 'Live Zoom lessons · unit papers · revision' },
  { src: '/lavindu-class-poster-02.jpeg', kicker: 'New class programme', title: 'A fresh start in maths.', note: 'Step-by-step learning for every grade' },
  { src: '/lavindu-grade-11-2025.jpeg', kicker: 'Grade 11 · 2025 O/L', title: 'Your next move starts here.', note: 'Focused revision and exam preparation' },
  { src: '/lavindu-student-message.jpeg', kicker: 'Student mindset', title: 'Start from where you are.', note: 'Small steps. Stronger confidence.' },
  { src: '/lavindu-maths-poster.jpeg', kicker: 'Ordinary Level', title: 'Maths with Lavindu.', note: 'Theory · practice · paper discussion' },
];

export function CampaignGallery() {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !stage.current) return;
    const image = stage.current.querySelector('img');
    const copy = stage.current.querySelector('.campaign-caption');
    gsap.fromTo(image, { autoAlpha: 0, scale: 1.045 }, { autoAlpha: 1, scale: 1, duration: .72, ease: 'power3.out' });
    gsap.fromTo(copy, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .55, delay: .12, ease: 'power3.out' });
  }, [active]);
  const move = (step: number) => setActive((active + step + posters.length) % posters.length);
  const current = posters[active];
  return <section className="campaign-gallery" id="gallery" data-reveal>
    <div className="campaign-shell wrap">
      <div className="campaign-head"><div><div className="eyebrow"><Images size={14}/> 04 / CLASS STORIES</div><h2>Not a poster wall.<br/><span>A story in motion.</span></h2></div><div className="campaign-intro"><p>Class programmes, O/L preparation and the ideas that keep students moving forward.</p><span>{String(active + 1).padStart(2, '0')} / {String(posters.length).padStart(2, '0')}</span></div></div>
      <div className="campaign-layout">
        <div className="campaign-stage" ref={stage}>
          <button className="campaign-image" onClick={() => setOpen(true)} aria-label={`Open ${current.title}`}><img src={current.src} alt={current.title}/><span className="campaign-expand"><Expand size={17}/> View poster</span></button>
          <div className="campaign-caption"><span>{current.kicker}</span><h3>{current.title}</h3><p>{current.note}</p></div>
          <div className="campaign-arrows"><button onClick={() => move(-1)} aria-label="Previous poster"><ArrowLeft/></button><button onClick={() => move(1)} aria-label="Next poster"><ArrowRight/></button></div>
        </div>
        <div className="campaign-index" role="tablist" aria-label="Class posters">{posters.map((poster, index) => <button key={poster.src} className={active === index ? 'active' : ''} onClick={() => setActive(index)} role="tab" aria-selected={active === index}><span className="campaign-thumb"><img src={poster.src} alt=""/></span><span className="campaign-tab-copy"><small>{String(index + 1).padStart(2, '0')} · {poster.kicker}</small><strong>{poster.title}</strong></span><ArrowRight size={17}/></button>)}</div>
      </div>
    </div>
    {open && <div className="campaign-lightbox" role="dialog" aria-modal="true" aria-label={current.title} onClick={() => setOpen(false)}><button className="campaign-close" onClick={() => setOpen(false)} aria-label="Close poster"><X/></button><img src={current.src} alt={current.title} onClick={event => event.stopPropagation()}/></div>}
  </section>;
}
