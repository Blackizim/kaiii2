export type VipPlanId = 'mensal' | 'trimestral' | 'anual';

export interface VipPlan {
  id: VipPlanId;
  badge: string;
  label: string;
  priceLabel: string;
  priceCents: number;
  durationDays: number;
  subtitle: string;
}

export const VIP_PLANS: VipPlan[] = [
  {
    id: 'mensal',
    badge: 'MENSAL',
    label: 'Mensal',
    priceLabel: 'R$ 9,90',
    priceCents: 990,
    durationDays: 30,
    subtitle: '30 dias',
  },
  {
    id: 'trimestral',
    badge: 'TRIMESTRAL',
    label: 'Trimestral',
    priceLabel: 'R$ 24,90',
    priceCents: 2490,
    durationDays: 90,
    subtitle: 'economize 16%',
  },
  {
    id: 'anual',
    badge: 'ANUAL',
    label: 'Anual',
    priceLabel: 'R$ 79,90',
    priceCents: 7990,
    durationDays: 365,
    subtitle: 'economize 33%',
  },
];

export const DEFAULT_VIP_BORDER_COLOR = '#2e7bff';

export const VIP_BORDER_COLORS = [
  '#2e7bff',
  '#00e5ff',
  '#eab308',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#10b981',
  '#f97316',
  '#ffffff',
] as const;

const DAY_MS = 86_400_000;

export function isAccountVip(
  account: { vipUntil?: number } | null | undefined,
  nowMs = Date.now()
): boolean {
  return Boolean(account?.vipUntil && Number.isFinite(account.vipUntil) && account.vipUntil > nowMs);
}

export function formatVipExpiration(vipUntil?: number): string {
  if (!vipUntil || !Number.isFinite(vipUntil)) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(vipUntil));
}

export function computeExtendedVipUntil(
  currentVipUntil: number | undefined,
  durationDays: number,
  nowMs = Date.now()
): number {
  const base = currentVipUntil && currentVipUntil > nowMs ? currentVipUntil : nowMs;
  return base + Math.max(1, Math.round(durationDays)) * DAY_MS;
}

export function getProfileRingColor(borderColor: string | undefined, isVip: boolean): string {
  if (!isVip || !borderColor) return DEFAULT_VIP_BORDER_COLOR;
  return (VIP_BORDER_COLORS as readonly string[]).includes(borderColor)
    ? borderColor
    : DEFAULT_VIP_BORDER_COLOR;
}

export type ParsedVipCodeResult =
  | {
      valid: true;
      normalizedCode: string;
      planId: VipPlanId;
      durationDays: number;
    }
  | {
      valid: false;
      reason: string;
    };

export function parseVipCode(
  rawCode: string,
  alreadyRedeemed: string[] = []
): ParsedVipCodeResult {
  const normalized = rawCode.trim().toUpperCase().replace(/\s+/g, '');
  if (!normalized) {
    return { valid: false, reason: 'Digite um código VIP para resgatar.' };
  }

  if (alreadyRedeemed.some((code) => code.toUpperCase() === normalized)) {
    return { valid: false, reason: 'Este código VIP já foi resgatado nesta conta.' };
  }

  const shortcutPlans: Record<string, VipPlanId> = {
    'KAIROU-MENSAL': 'mensal',
    'KAIROU-TRIMESTRAL': 'trimestral',
    'KAIROU-ANUAL': 'anual',
    'KAIROU-VIP': 'mensal',
  };

  if (shortcutPlans[normalized]) {
    const plan = VIP_PLANS.find((p) => p.id === shortcutPlans[normalized])!;
    return {
      valid: true,
      normalizedCode: normalized,
      planId: plan.id,
      durationDays: plan.durationDays,
    };
  }

  const match = normalized.match(/^KAI-(MENSAL|TRIMESTRAL|ANUAL|VIP)-([A-Z0-9]{4})-([A-Z0-9]{4})$/);
  if (!match) {
    return {
      valid: false,
      reason: 'Código inválido. Use o formato KAI-ANUAL-XXXX-XXXX.',
    };
  }

  const tier = match[1];
  const planId: VipPlanId =
    tier === 'ANUAL'
      ? 'anual'
      : tier === 'TRIMESTRAL'
      ? 'trimestral'
      : 'mensal';

  const plan = VIP_PLANS.find((p) => p.id === planId)!;
  return {
    valid: true,
    normalizedCode: normalized,
    planId: plan.id,
    durationDays: plan.durationDays,
  };
}

export function validatePixIdentifier(raw: string): { valid: boolean; cleaned: string; reason?: string } {
  const cleaned = raw.trim();
  if (!cleaned) {
    return { valid: false, cleaned, reason: 'Informe o nome ou e-mail usado no PixGG.' };
  }
  if (cleaned.includes('@')) {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
    return emailOk
      ? { valid: true, cleaned }
      : { valid: false, cleaned, reason: 'Informe um e-mail válido do PixGG.' };
  }
  if (cleaned.length < 3) {
    return { valid: false, cleaned, reason: 'Digite pelo menos 3 caracteres do nome ou e-mail.' };
  }
  return { valid: true, cleaned };
}
