/** Minimal shape of yt-dlp's --dump-json output that we actually consume. */
export interface YtDlpFormatJson {
  format_id: string;
  ext: string;
  protocol?: string;
  url?: string;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  vcodec?: string | null;
  acodec?: string | null;
  tbr?: number | null;
  abr?: number | null;
  asr?: number | null;
  filesize?: number | null;
  filesize_approx?: number | null;
  format_note?: string | null;
  resolution?: string | null;
}

export interface YtDlpSubtitleJson {
  url: string;
  ext: string;
  name?: string;
}

export interface YtDlpInfoJson {
  id: string;
  title: string;
  uploader?: string | null;
  channel?: string | null;
  duration?: number | null;
  thumbnail?: string | null;
  upload_date?: string | null;
  webpage_url?: string | null;
  extractor_key?: string | null;
  is_live?: boolean | null;
  url?: string;
  ext?: string;
  format_id?: string;
  protocol?: string;
  width?: number | null;
  height?: number | null;
  filesize?: number | null;
  filesize_approx?: number | null;
  vcodec?: string | null;
  acodec?: string | null;
  formats?: YtDlpFormatJson[];
  subtitles?: Record<string, YtDlpSubtitleJson[]>;
  automatic_captions?: Record<string, YtDlpSubtitleJson[]>;
}
