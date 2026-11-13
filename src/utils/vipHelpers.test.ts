import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VIP_PLANS,
  computeExtendedVipUntil,
  formatVipExpiration,
  getProfileRingColor,
  isAccountVip,
  parseVipCode,
  validatePixIdentifier,
} from './vipHelpers.ts';

describe('vipHelpers', () => {
  it('exposes the three expected Kairou VIP plans with accurate pricing and days', () => {
    assert.equal(VIP_PLANS.length, 3);
    assert.deepEqual(
      VIP_PLANS.map((p) => [p.id, p.priceLabel, p.durationDays]),
      [
        ['mensal', 'R$ 9,90', 30],
        ['trimestral', 'R$ 24,90', 90],
        ['anual', 'R$ 79,90', 365],
      ]
    );
  });

  it('determines VIP status and formats expiration date in pt-BR', () => {
    const now = Date.UTC(2026, 5, 1, 12, 0, 0);
    assert.equal(isAccountVip(null, now), false);
    assert.equal(isAccountVip({ vipUntil: now - 1000 }, now), false);
    assert.equal(isAccountVip({ vipUntil: now + 86_400_000 }, now), true);

    const formatted = formatVipExpiration(Date.UTC(2027, 11, 9, 12, 0, 0));
    assert.equal(formatted, '09/12/2027');
  });

  it('extends VIP duration from now when inactive or from current expiration when active', () => {
    const now = 1_700_000_000_000;
    const day = 86_400_000;
    assert.equal(computeExtendedVipUntil(undefined, 30, now), now + 30 * day);
    assert.equal(computeExtendedVipUntil(now - 5 * day, 90, now), now + 90 * day);
    assert.equal(computeExtendedVipUntil(now + 10 * day, 365, now), now + 375 * day);
  });

  it('resolves custom profile border colors only when VIP is active', () => {
    assert.equal(getProfileRingColor('#eab308', false), '#2e7bff');
    assert.equal(getProfileRingColor('#eab308', true), '#eab308');
    assert.equal(getProfileRingColor('#123456', true), '#2e7bff');
  });

  it('parses valid VIP redemption codes and rejects invalid or duplicate codes', () => {
    const res = parseVipCode('  kai-anual-2026-abcd  ', []);
    assert.equal(res.valid, true);
    if (res.valid) {
      assert.equal(res.planId, 'anual');
      assert.equal(res.durationDays, 365);
      assert.equal(res.normalizedCode, 'KAI-ANUAL-2026-ABCD');
    }

    const dup = parseVipCode('KAI-ANUAL-2026-ABCD', ['KAI-ANUAL-2026-ABCD']);
    assert.equal(dup.valid, false);

    const invalid = parseVipCode('INVALID-CODE', []);
    assert.equal(invalid.valid, false);

    const shortcut = parseVipCode('kairou-vip', []);
    assert.equal(shortcut.valid, true);
    if (shortcut.valid) {
      assert.equal(shortcut.durationDays, 30);
    }
  });

  it('validates PixGG payer identifier cleanly', () => {
    assert.equal(validatePixIdentifier('').valid, false);
    assert.equal(validatePixIdentifier('ab').valid, false);
    assert.equal(validatePixIdentifier('bad@email').valid, false);
    assert.equal(validatePixIdentifier('user@gmail.com').valid, true);
    assert.equal(validatePixIdentifier('Pommern').valid, true);
  });
});
