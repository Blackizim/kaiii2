import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Copy, Crown, ExternalLink, KeyRound, X, Zap } from 'lucide-react';
import type { Account } from './AccountModal';
import {
  VIP_PLANS,
  computeExtendedVipUntil,
  formatVipExpiration,
  isAccountVip,
  parseVipCode,
  validatePixIdentifier,
  type VipPlanId,
} from '../utils/vipHelpers';

interface VipModalProps {
  account: Account;
  onUpdateAccount: (updated: Account) => void;
  onClose: () => void;
}

export const VipModal: React.FC<VipModalProps> = ({ account, onUpdateAccount, onClose }) => {
  const [selectedPlanId, setSelectedPlanId] = useState<VipPlanId>('trimestral');
  const [pixStepOpen, setPixStepOpen] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [pixIdentifier, setPixIdentifier] = useState('');
  const [vipCode, setVipCode] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const pixInputRef = useRef<HTMLInputElement>(null);

  const vipActive = isAccountVip(account);
  const expirationLabel = formatVipExpiration(account.vipUntil);
  const selectedPlan = VIP_PLANS.find((p) => p.id === selectedPlanId) ?? VIP_PLANS[1];
  const pixReference = `KAIROU-VIP-${selectedPlan.badge}-${account.email.split('@')[0].toUpperCase().slice(0, 8)}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleOpenPix = () => {
    setPixStepOpen(true);
    setFeedback(null);
    setTimeout(() => pixInputRef.current?.focus(), 60);
  };

  const handleCopyPixRef = async () => {
    try {
      await navigator.clipboard.writeText(pixReference);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleConfirmPix = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validatePixIdentifier(pixIdentifier);
    if (!check.valid) {
      setFeedback({ kind: 'error', text: check.reason || 'Informe os dados do PixGG.' });
      return;
    }

    const nextVipUntil = computeExtendedVipUntil(account.vipUntil, selectedPlan.durationDays);
    onUpdateAccount({
      ...account,
      vipUntil: nextVipUntil,
    });
    setPixIdentifier('');
    setPixStepOpen(false);
    setFeedback({
      kind: 'success',
      text: `Plano ${selectedPlan.label} ativado! VIP válido até ${formatVipExpiration(nextVipUntil)}.`,
    });
  };

  const handleRedeemCode = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseVipCode(vipCode, account.redeemedVipCodes ?? []);
    if (!parsed.valid) {
      setFeedback({ kind: 'error', text: parsed.reason });
      return;
    }

    const nextVipUntil = computeExtendedVipUntil(account.vipUntil, parsed.durationDays);
    onUpdateAccount({
      ...account,
      vipUntil: nextVipUntil,
      redeemedVipCodes: [...(account.redeemedVipCodes ?? []), parsed.normalizedCode],
    });
    setVipCode('');
    setFeedback({
      kind: 'success',
      text: `Código ${parsed.normalizedCode} resgatado! VIP válido até ${formatVipExpiration(nextVipUntil)}.`,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kairou-vip-title"
      onClick={onClose}
      className="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-kairou-modal relative w-full max-w-[500px] rounded-[24px] border border-white/12 bg-[#111824] p-5 sm:p-6 text-white shadow-[0_32px_90px_-20px_rgba(0,0,0,0.95)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar Kairou VIP"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-slate-300 transition-colors hover:bg-white/15 hover:text-white cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Title & Benefits */}
        <div className="pr-10">
          <h2 id="kairou-vip-title" className="flex items-center gap-2 font-display text-[22px] font-extrabold tracking-tight text-white">
            <Crown className="h-5 w-5 fill-[#fde047] text-[#fde047]" />
            <span>Kairou VIP</span>
          </h2>
          <p className="mt-1 text-[13px] text-slate-400">
            4K UHD · Zero anúncios · Servidor VIP · 5 perfis
          </p>

          {vipActive && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fde047] px-3 py-1 text-xs font-extrabold text-slate-950 shadow-sm">
                <Crown className="h-3.5 w-3.5 fill-slate-950 text-slate-950" />
                VIP ativo
              </span>
              <span className="text-[13px] text-slate-400 tabular-nums">até {expirationLabel}</span>
            </div>
          )}
        </div>

        {/* 3 Plan Cards */}
        <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3">
          {VIP_PLANS.map((plan) => {
            const selected = plan.id === selectedPlanId;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => {
                  setSelectedPlanId(plan.id);
                  setFeedback(null);
                }}
                className={`flex flex-col items-center justify-center rounded-2xl px-2 py-4 text-center transition-all cursor-pointer ${
                  selected
                    ? 'border-2 border-[#0ea5e9] bg-[#162844] shadow-[0_0_24px_-8px_rgba(14,165,233,0.6)]'
                    : 'border border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.07]'
                }`}
              >
                <span className="text-[10.5px] font-bold tracking-wider text-slate-400">
                  {plan.badge}
                </span>
                <span className="mt-1 font-display text-lg sm:text-[21px] font-extrabold text-white tabular-nums">
                  {plan.priceLabel}
                </span>
                <span className="mt-1 text-[11px] font-bold text-emerald-400">
                  {plan.subtitle}
                </span>
              </button>
            );
          })}
        </div>

        {/* Checkout & Redemption Panel */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
          <button
            type="button"
            onClick={handleOpenPix}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#22d3ee] to-[#0ea5e9] px-4 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_-10px_rgba(14,165,233,0.75)] transition-all hover:brightness-110 active:scale-[0.99] cursor-pointer"
          >
            <Zap className="h-4 w-4 fill-current" />
            <span>
              Pagar {selectedPlan.label} ({selectedPlan.priceLabel}) no Pix
            </span>
          </button>

          {pixStepOpen && (
            <div className="rounded-xl border border-sky-400/25 bg-sky-500/10 p-3 text-xs text-slate-200 space-y-2 animate-vaelor-enter">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sky-200">
                  PixGG · Plano {selectedPlan.label} ({selectedPlan.priceLabel})
                </span>
                <a
                  href="https://pixgg.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-sky-300 underline hover:text-white"
                >
                  Abrir PixGG
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2">
                <code className="truncate text-[11px] text-slate-200">{pixReference}</code>
                <button
                  type="button"
                  onClick={handleCopyPixRef}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20 cursor-pointer"
                >
                  {copiedPix ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copiedPix ? 'Copiado' : 'Copiar ref.'}
                </button>
              </div>
              <p className="text-[11px] text-slate-300/90">
                Após concluir no PixGG, informe o nome ou e-mail abaixo e clique em Confirmar para liberar seu VIP.
              </p>
            </div>
          )}

          <form onSubmit={handleConfirmPix} className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <CheckCircle2 className="h-3.5 w-3.5 fill-sky-400 text-[#111824]" />
              <span>Já pagou? Confirme seu Pix:</span>
            </label>
            <div className="flex gap-2">
              <input
                ref={pixInputRef}
                type="text"
                value={pixIdentifier}
                onChange={(e) => setPixIdentifier(e.target.value)}
                placeholder="Nome ou e-mail no PixGG"
                className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/12 cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </form>

          <form onSubmit={handleRedeemCode} className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <KeyRound className="h-3.5 w-3.5 text-sky-400" />
              <span>Resgatar código VIP:</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={vipCode}
                onChange={(e) => setVipCode(e.target.value)}
                placeholder="Ex: KAI-ANUAL-XXXX-XXXX"
                className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm uppercase text-white placeholder:normal-case placeholder:text-slate-500 outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/12 cursor-pointer"
              >
                Resgatar
              </button>
            </div>
          </form>

          {feedback && (
            <p
              role={feedback.kind === 'error' ? 'alert' : 'status'}
              className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                feedback.kind === 'success'
                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-red-400/30 bg-red-500/10 text-red-200'
              }`}
            >
              {feedback.text}
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-[11.5px] text-slate-400">
          Pagamento instantâneo via{' '}
          <a
            href="https://pixgg.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-slate-200 underline hover:text-white"
          >
            PixGG
          </a>
          . Sem assinatura recorrente.
        </p>
      </div>
    </div>
  );
};
