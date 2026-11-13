import React from 'react';
import { Trash2, X } from 'lucide-react';
import type { VaelorSettings } from '../types/player';

interface SettingsModalProps {
  isOpen: boolean;
  settings: VaelorSettings;
  onUpdateSettings: (next: VaelorSettings) => void;
  onClearHistory: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onClearHistory,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Configurações do Kairou"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#12141B] border border-white/14 p-6 space-y-5 shadow-2xl animate-vaelor-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="font-display text-lg font-bold text-white">Preferências do Kairou</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações"
            className="p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="font-medium text-white">Priorizar Áudio Português (PT-BR)</p>
              <p className="text-xs text-stone-400">
                Seleciona automaticamente servidores dublados quando disponíveis.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.preferPtBr}
              onChange={(e) =>
                onUpdateSettings({ ...settings, preferPtBr: e.target.checked })
              }
              className="w-4 h-4 accent-white cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="font-medium text-white">Ativar Legendas por Padrão</p>
              <p className="text-xs text-stone-400">
                Carrega automaticamente faixas em Português (BR) no player.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.defaultSubtitlesOn}
              onChange={(e) =>
                onUpdateSettings({ ...settings, defaultSubtitlesOn: e.target.checked })
              }
              className="w-4 h-4 accent-white cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="font-medium text-white">Reprodução Automática em Séries</p>
              <p className="text-xs text-stone-400">
                Prepara o próximo episódio automaticamente ao selecionar uma série.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoplayNextEpisode}
              onChange={(e) =>
                onUpdateSettings({ ...settings, autoplayNextEpisode: e.target.checked })
              }
              className="w-4 h-4 accent-white cursor-pointer"
            />
          </label>
        </div>

        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar Continuar Assistindo
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-white text-stone-950 text-xs font-semibold hover:bg-stone-200 cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
