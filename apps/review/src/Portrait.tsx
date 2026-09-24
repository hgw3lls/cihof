export function Portrait({ src, name, small = false }: { src: string | null; name: string; small?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('');
  return src
    ? <img className={small ? 'portrait portrait--small' : 'portrait'} src={src} alt="" loading="lazy" />
    : <span className={small ? 'portrait portrait--small portrait--none' : 'portrait portrait--none'} aria-hidden="true">{initials}</span>;
}
