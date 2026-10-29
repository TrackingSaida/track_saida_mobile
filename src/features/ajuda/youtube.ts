const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export type UrlsYouTube = {
  principal: string;
  reserva: string;
  miniatura: string;
};

export function idYouTubeValido(id: string): boolean {
  return VIDEO_ID.test(id);
}

export function hostYouTubeValido(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "youtube.com" || host === "youtu.be";
  } catch {
    return false;
  }
}

export function urlsDoVideo(id: string): UrlsYouTube | null {
  if (!idYouTubeValido(id)) return null;
  const principal = `https://www.youtube.com/shorts/${id}`;
  const reserva = `https://www.youtube.com/watch?v=${id}`;
  const miniatura = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  if (!hostYouTubeValido(principal) || !hostYouTubeValido(reserva)) return null;
  return { principal, reserva, miniatura };
}
