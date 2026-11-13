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
    }, { rootMargin: '120px 120px 120px 120px', threshold: 0.01 });
    const vh = window.innerHeight || 900;
    cards.forEach(element => {
      if (element.classList.contains('scroll-reveal-visible')) return;
      const rect = element.getBoundingClientRect();
      if (rect.top < vh + 100) {
        element.classList.add('scroll-reveal-visible');
        return;
      }
      const index = Array.from(element.parentElement?.children ?? []).indexOf(element);
      element.style.setProperty('--reveal-delay', `${Math.min(Math.max(index, 0), 8) * 30}ms`);
      element.classList.add('scroll-reveal');
      observer.observe(element);
    });
    return () => observer.disconnect();
  }, dependencies);
  return ref;
}
