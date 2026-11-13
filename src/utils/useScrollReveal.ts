import { useLayoutEffect, useRef } from 'react';

export function useScrollReveal<T extends HTMLElement>(dependencies: readonly unknown[]) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-scroll-reveal]'));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('scroll-reveal-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    cards.forEach(element => {
      if (element.classList.contains('scroll-reveal-visible')) return;
      const index = Array.from(element.parentElement?.children ?? []).indexOf(element);
      element.style.setProperty('--reveal-delay', `${Math.min(Math.max(index, 0), 10) * 38}ms`);
      element.classList.add('scroll-reveal');
      observer.observe(element);
    });
    return () => observer.disconnect();
  }, dependencies);
  return ref;
}
