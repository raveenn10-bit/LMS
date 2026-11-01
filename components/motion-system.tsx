'use client';

import { useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function MotionSystem() {
  useLayoutEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('[data-reveal], .section-head, .teacher-feature, .locations-card, .portal-section, .faq, .cta').forEach((element) => gsap.fromTo(element, { autoAlpha: 0, y: 54 }, { autoAlpha: 1, y: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 88%', once: true } }));
      gsap.utils.toArray<HTMLElement>('.course-grid, .class-benefits, .steps').forEach((group) => gsap.fromTo(Array.from(group.children), { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: .68, stagger: .09, ease: 'power3.out', scrollTrigger: { trigger: group, start: 'top 88%', once: true } }));
      gsap.to('.portrait > img', { yPercent: 7, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .7 } });
    });
    return () => context.revert();
  }, []);
  return null;
}
