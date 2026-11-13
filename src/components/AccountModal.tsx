import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ProfileEditor } from './ProfileEditor';
import { ProfileGate } from './ProfileGate';

export type Profile = { id: string; name: string; color: string; avatar?: string; kids?: boolean; maxRating?: string };
export type Account = { email: string; salt: string; hash: string; profiles: Profile[] };
const ACCOUNTS = 'kairou_accounts_v1';
export const readAccounts = (): Account[] => { try { const data = JSON.parse(localStorage.getItem(ACCOUNTS) || '[]'); return Array.isArray(data) ? data : []; } catch { return []; } };
const saveAccounts = (accounts: Account[]) => localStorage.setItem(ACCOUNTS, JSON.stringify(accounts));
async function passwordHash(password: string, salt: string) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 150000, hash: 'SHA-256' }, material, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
}
const colors = ['#3269a8', '#8359a8', '#b9685b', '#388a83', '#a7833c'];
const makeProfile = (name: string): Profile => ({ id: crypto.randomUUID(), name, color: colors[Math.floor(Math.random() * colors.length)] });

export function AccountModal({ account, profile, onAccount, onProfile, onClose, onLogout, initialEdit, initialAdd, initialManage }: { account: Account | null; profile: Profile | null; onAccount: (a: Account) => void; onProfile: (p: Profile) => void; onClose: () => void; onLogout: () => void; initialEdit?: Profile | null; initialAdd?: boolean; initialManage?: boolean }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [managing, setManaging] = useState(Boolean(initialManage));
  const [editing, setEditing] = useState<Profile | null>(initialEdit || null);
  const [adding, setAdding] = useState(Boolean(initialAdd));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); const address = email.trim().toLowerCase();
    if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return; }
    if (mode === 'register' && password !== confirm) { setError('As senhas não coincidem.'); return; }
    setBusy(true);
    try {
      const accounts = readAccounts(); const existing = accounts.find(a => a.email === address);
      if (mode === 'register') {
        if (existing) { setError('Já existe uma conta com este e-mail neste navegador.'); return; }
        const salt = crypto.randomUUID(); const created = { email: address, salt, hash: await passwordHash(password, salt), profiles: [makeProfile('Meu perfil')] };
        saveAccounts([...accounts, created]); onAccount(created);
      } else {
        if (!existing || await passwordHash(password, existing.salt) !== existing.hash) { setError('E-mail ou senha incorretos.'); return; }
        onAccount(existing);
      }
    } catch { setError('Não foi possível salvar ou acessar a conta neste navegador.'); } finally { setBusy(false); }
  };
  const updateProfiles = (profiles: Profile[]) => { if (!account) return; const updated = { ...account, profiles }; saveAccounts(readAccounts().map(a => a.email === account.email ? updated : a)); onAccount(updated); };

  if (account) return <><ProfileGate profiles={account.profiles} active={profile} managing={managing} onManage={() => setManaging(!managing)} onSelect={p => { onProfile(p); onClose(); }} onEdit={setEditing} onAdd={() => setAdding(true)} onClose={onClose}/>{(adding || editing) && <ProfileEditor isNew={!editing} initial={editing || { id: crypto.randomUUID(), name: `Perfil ${account.profiles.length + 1}`, color: "#2e7bff" }} canDelete={Boolean(editing) && account.profiles.length > 1} onCancel={() => { setAdding(false); setEditing(null); }} onSave={next => { updateProfiles(editing ? account.profiles.map(p => p.id === next.id ? next : p) : [...account.profiles, next]); setEditing(null); setAdding(false); }} onDelete={() => { if (editing && window.confirm(`Excluir o perfil ${editing.name} e seus dados?`)) { updateProfiles(account.profiles.filter(p => p.id !== editing.id)); ['vaelor_mylist_v1', 'vaelor_watched_v1', 'vaelor_continue_v1'].forEach(key => localStorage.removeItem(`${key}:${encodeURIComponent(account.email)}:${editing.id}`)); if (profile?.id === editing.id) onProfile(account.profiles.find(p => p.id !== editing.id)!); setEditing(null); } }}/>}</>;
  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#090e17] flex items-center justify-center p-4" style={account ? { background: 'radial-gradient(ellipse 70% 65% at 50% 15%, #1b325c 0%, #121d30 48%, #0b101a 85%)' } : undefined} role="dialog" aria-modal="true" aria-label={account ? 'Perfis' : 'Entrar'} onClick={onClose}>
    <button onClick={onClose} className="fixed right-5 top-5 rounded-full border border-white/15 p-2 text-slate-300 hover:bg-white/10" aria-label="Fechar"><X size={20}/></button>
    <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-[440px] rounded-3xl border border-white/10 bg-[#0e131d] p-6 shadow-2xl">
      <p className="text-xs font-bold tracking-[.18em] text-slate-500">KAIROU</p><h1 className="mt-4 text-2xl font-bold text-white">{mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
      <p className="mt-2 text-sm text-slate-400">Seus perfis, lista e histórico salvos neste navegador.</p>
      <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/[.03] p-1">{(['login','register'] as const).map(m => <button type="button" key={m} onClick={() => { setMode(m); setError(''); }} className={`rounded-full px-4 py-2 text-xs font-bold ${mode === m ? 'bg-white/10 text-white' : 'text-slate-400'}`}>{m === 'login' ? 'Entrar' : 'Criar conta'}</button>)}</div>
      <label className="mt-6 block text-xs font-bold tracking-wide text-slate-500">E-MAIL<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" className="mt-2 block w-full rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-base font-normal text-white outline-none focus:border-blue-500"/></label>
      <label className="mt-5 block text-xs font-bold tracking-wide text-slate-500">SENHA<input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="mínimo 8 caracteres" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="mt-2 block w-full rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-base font-normal text-white outline-none focus:border-blue-500"/></label>
      {mode === 'register' && <label className="mt-5 block text-xs font-bold tracking-wide text-slate-500">CONFIRMAR SENHA<input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="repita a senha" autoComplete="new-password" className="mt-2 block w-full rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-base font-normal text-white outline-none focus:border-blue-500"/></label>}
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}<button disabled={busy} className="mt-5 w-full rounded-full bg-white px-5 py-3 text-sm font-bold text-[#0b1019] disabled:opacity-50">{busy ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
    </form>
  </div>;
}
