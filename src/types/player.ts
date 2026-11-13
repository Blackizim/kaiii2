export interface AnonymizedStream {
  id: string;
  label: string;
  audio: string;
  quality: string;
  codec: 'h264' | 'h265';
  format: 'hls' | 'mp4';
  isPtBr: boolean;
  is4k: boolean;
  streamUrl: string;
}

export interface AnonymizedSubtitle {
  id: string;
  lang: string;
  label: string;
  trackUrl: string;
}

export interface AnonymizedExtractResponse {
  elapsedMs: number;
  cached: boolean;
  resolvedTitle?: string;
  streams: AnonymizedStream[];
  subtitles: AnonymizedSubtitle[];
}

export interface SubtitleStyleConfig {
  fontSize: 'sm' | 'md' | 'lg';
  bgOpacity: number;
  textColor: '#FFFFFF' | '#FDE047';
}

export interface VaelorSettings {
  preferPtBr: boolean;
  autoplayNextEpisode: boolean;
  defaultSubtitlesOn: boolean;
  subtitleStyle: SubtitleStyleConfig;
}

export const DEFAULT_VAELOR_SETTINGS: VaelorSettings = {
  preferPtBr: true,
  autoplayNextEpisode: true,
  defaultSubtitlesOn: false,
  subtitleStyle: {
    fontSize: 'md',
    bgOpacity: 0.65,
    textColor: '#FFFFFF',
  },
};
