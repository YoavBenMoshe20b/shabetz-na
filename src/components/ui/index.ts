// Centralised design-system barrel. Pages and Home variants should
// import their visual primitives from here, not write raw Tailwind
// inline. Adding/changing a variant happens once, in one file.

export { Card }                                  from './Card';
export { Button }                                from './Button';
export { StatusPill, StatusDot }                 from './StatusPill';
export { Section, PageMain, CollapsibleSection } from './Section';
export { EmergencyBanner }                       from './EmergencyBanner';
export {
  PageTitle, HeroTitle, SectionLabel, CardTitle,
  Body, Muted, Hint, Metric,
} from './Text';
export { layout } from './tokens';
