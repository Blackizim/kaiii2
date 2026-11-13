import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, Clapperboard, Film, Lock, Search, Smile, Trash2, X } from 'lucide-react';
import type { Profile } from './AccountModal';
import { DEFAULT_VIP_BORDER_COLOR, VIP_BORDER_COLORS, getProfileRingColor } from '../utils/vipHelpers';
import './ProfileEditor.css';

const COLORS = [
  '#2e7bff',
  '#00c2ff',
  '#12c48b',
  '#8b5cf6',
  '#f0568c',
  '#ff8a3d',
  '#ffce3a',
  '#4ade80',
  '#22d3ee',
  '#a78bfa',
  '#f472b6',
  '#fb7185',
];

const smiley = (color: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="26" fill="${color}"/><circle cx="36" cy="40" r="6" fill="#fff"/><circle cx="64" cy="40" r="6" fill="#fff"/><path d="M32 60q18 16 36 0" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`
  )}`;

type Avatar = { url: string; label: string };

export function ProfileEditor({
  initial,
  isNew,
  isVip = false,
  canDelete,
  onSave,
  onCancel,
  onDelete,
  onRequireVip,
}: {
  initial: Profile;
  isNew: boolean;
  isVip?: boolean;
  canDelete: boolean;
  onSave: (profile: Profile) => void;
  onCancel: () => void;
  onDelete: () => void;
  onRequireVip?: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color || COLORS[0]);
  const [borderColor, setBorderColor] = useState(
    getProfileRingColor(initial.borderColor, isVip)
  );
  const [avatar, setAvatar] = useState(initial.avatar || '');
  const [tab, setTab] = useState<'smiley' | 'anime' | 'media'>(initial.avatar ? 'media' : 'smiley');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Avatar[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [kids, setKids] = useState(initial.kids || false);
  const [maxRating, setMaxRating] = useState(initial.maxRating || '18');

  useEffect(() => {
    if (tab === 'smiley') return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus('Carregando…');
      try {
        if (tab === 'anime') {
          const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              query:
                'query ($search:String){Page(perPage:24){characters(search:$search,sort:FAVOURITES_DESC){name{full} image{large}}}}',
              variables: { search: query.trim() || null },
            }),
            signal: controller.signal,
          });
          if (!response.ok) throw Error();
          const json = await response.json();
          setItems(
            (json.data?.Page?.characters || []).map((c: { name: { full: string }; image: { large: string } }) => ({
              label: c.name.full,
              url: c.image.large,
            }))
          );
        } else {
          const url = query.trim() ? `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query.trim())}` : '';
          const shows = url ? await (await fetch(url, { signal: controller.signal })).json() : [];
          const ids = url
            ? shows.slice(0, 1).map((s: { show: { id: number } }) => s.show.id)
            : [169, 82, 2993, 1389, 431, 89];
          const casts = await Promise.all(
            ids.map(async (id: number) => {
              const r = await fetch(`https://api.tvmaze.com/shows/${id}/cast`, { signal: controller.signal });
              return r.ok ? r.json() : [];
            })
          );
          setItems(
            casts
              .flatMap(
                (
                  cast: Array<{
                    person?: { name: string; image?: { medium: string } };
                    character?: { name: string; image?: { medium: string } };
                  }>
                ) =>
                  cast.slice(0, 6).map((c) => ({
                    label: c.character?.name || c.person?.name || '',
                    url: c.person?.image?.medium || c.character?.image?.medium || '',
                  }))
              )
              .filter((i: Avatar) => i.url)
              .slice(0, 30)
          );
        }
        setStatus('');
      } catch {
        if (!controller.signal.aborted) {
          setItems([]);
          setStatus('Não foi possível carregar os avatares. Tente novamente.');
        }
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [tab, query]);

  const activeBorderColor = isVip ? borderColor : DEFAULT_VIP_BORDER_COLOR;

  return (
    <div className="rea-profile">
      <div className="modal">
        <div className="modal__backdrop" onClick={onCancel} />
        <div className="modal__panel" role="dialog" aria-modal="true" aria-labelledby="pm-title">
          <button className="modal__close" type="button" onClick={onCancel} aria-label="Fechar">
            <X size={18} />
          </button>
          <h3 className="modal__title" id="pm-title">
            {isNew ? 'Novo perfil' : 'Editar perfil'}
          </h3>
          <p className="modal__sub">Personalize o avatar, o nome e o que este perfil pode ver.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              try {
                onSave({
                  ...initial,
                  name: name.trim(),
                  color,
                  borderColor: isVip ? borderColor : initial.borderColor,
                  avatar: avatar || undefined,
                  kids,
                  maxRating,
                });
              } catch {
                setError('Não foi possível salvar o perfil neste navegador.');
              }
            }}
          >
            <div className="pm__hero">
              <div className="pm__preview" style={{ '--ring': activeBorderColor } as React.CSSProperties}>
                <img src={avatar || smiley(color)} alt="" />
              </div>
              <div className="pm__fields">
                <label className="field">
                  <span>Nome do perfil</span>
                  <input
                    autoFocus
                    required
                    maxLength={24}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Pommern"
                  />
                </label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={kids}
                    onChange={(e) => {
                      setKids(e.target.checked);
                      if (e.target.checked) setMaxRating('10');
                    }}
                  />
                  <span className="switch__box" aria-hidden="true" />
                  <span className="switch__text">
                    <strong>Perfil infantil</strong>
                    <small>Só conteúdo até 10 anos, sem títulos adultos.</small>
                  </span>
                </label>
              </div>
            </div>

            <div className="pm__section">
              <div className="pm__section-head">
                <h4>Galeria de avatares</h4>
              </div>
              <p className="pm__hint">Uma cor clássica ou um personagem de anime, filme ou série.</p>
              <div className="tabs tabs--sm">
                {(
                  [
                    { id: 'smiley', label: 'Smileys', icon: <Smile size={13} /> },
                    { id: 'anime', label: 'Animes', icon: <Film size={13} /> },
                    { id: 'media', label: 'Filmes & Séries', icon: <Clapperboard size={13} /> },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={tab === t.id ? 'is-active' : ''}
                    onClick={() => {
                      setTab(t.id);
                      setQuery('');
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
              {tab !== 'smiley' && (
                <div className="pm__search">
                  <Search size={14} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={tab === 'anime' ? 'Pesquise personagens (ex.: Goku, Levi)…' : 'Pesquise uma série…'}
                  />
                </div>
              )}
              <div className="avatar-grid">
                {tab === 'smiley' ? (
                  COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      className={`avatar-cell${!avatar && color === c ? ' is-selected' : ''}`}
                      aria-label={`Escolher avatar ${c}`}
                      onClick={() => {
                        setColor(c);
                        setAvatar('');
                      }}
                    >
                      <img src={smiley(c)} alt="" />
                    </button>
                  ))
                ) : status ? (
                  <p className="avatar-state">{status}</p>
                ) : items.length ? (
                  items.map((item, i) => (
                    <button
                      type="button"
                      key={`${item.url}-${i}`}
                      title={item.label}
                      aria-label={item.label}
                      className={`avatar-cell${avatar === item.url ? ' is-selected' : ''}`}
                      onClick={() => setAvatar(item.url)}
                    >
                      <img src={item.url} alt="" loading="lazy" />
                    </button>
                  ))
                ) : (
                  <p className="avatar-state">Nada encontrado.</p>
                )}
              </div>
            </div>

            <div className="pm__section pm__section--border-color">
              <div className="pm__section-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h4>Cor da borda do perfil</h4>
                  <span className="rea-vip">VIP</span>
                </div>
                <span style={{ fontSize: 11.5, color: isVip ? '#34d399' : 'var(--muted-2)' }}>
                  {isVip ? 'Desbloqueado' : 'Bloqueado para não-VIPs'}
                </span>
              </div>
              <p className="pm__hint">
                Personalize a cor da borda do seu avatar no topo e nas telas. Exclusivo para membros VIP.
              </p>
              <div className="pm__color-row">
                {VIP_BORDER_COLORS.map((c, i) => {
                  const locked = !isVip && i !== 0;
                  const selected = activeBorderColor === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      style={{ '--btn-color': c } as React.CSSProperties}
                      className={`pm__color-btn${selected ? ' is-selected' : ''}${locked ? ' is-locked' : ''}`}
                      title={locked ? 'Exclusivo VIP — clique para ver planos' : `Borda ${c}`}
                      onClick={() => {
                        if (locked) {
                          onRequireVip?.();
                          return;
                        }
                        setBorderColor(c);
                      }}
                    >
                      <span className="pm__color-swatch" style={{ background: c }} />
                      {selected && (
                        <Check
                          className="pm__color-check"
                          size={12}
                          style={{ color: c === '#ffffff' || c === '#eab308' ? '#0f172a' : '#ffffff' }}
                        />
                      )}
                      {locked && <Lock className="pm__color-lock" size={11} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pm__section">
              <h4>Classificação etária máxima</h4>
              <div className="select-wrap">
                <select
                  value={maxRating}
                  onChange={(e) => {
                    setMaxRating(e.target.value);
                    if (Number(e.target.value) > 10) setKids(false);
                  }}
                >
                  {['L', '10', '12', '14', '16', '18'].map((v) => (
                    <option key={v} value={v}>
                      {v === 'L' ? 'Livre' : v === '18' ? 'Todas as classificações' : `${v} anos`}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                />
              </div>
              <p className="pm__hint">Títulos acima da classificação escolhida ficam bloqueados neste perfil.</p>
            </div>
            {error && (
              <p role="alert" className="pm__hint" style={{ color: '#fca5a5' }}>
                {error}
              </p>
            )}
            <div className="pm__actions">
              {canDelete && (
                <button type="button" className="btn btn--danger-ghost" onClick={onDelete}>
                  <Trash2 size={16} /> Excluir perfil
                </button>
              )}
              <span className="pm__spacer" />
              <button type="button" className="btn btn--glass" onClick={onCancel}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary">
                {isNew ? 'Criar perfil' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
