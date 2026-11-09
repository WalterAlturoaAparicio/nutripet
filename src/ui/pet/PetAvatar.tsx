import { PetSvg } from './PetSvg';
import type { Stage } from './geometry';

/** Pet face for the profile selector; a neutral silhouette when no pet is known. */
export function PetAvatar({ stage, size = 64 }: { stage: string | null; size?: number }) {
  if (stage) return <PetSvg stage={stage as Stage} size={size} />;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <path d="M136 214 L168 108 L228 178 Z" fill="#e8d9c4" />
      <path d="M376 214 L344 108 L284 178 Z" fill="#e8d9c4" />
      <ellipse cx="256" cy="290" rx="150" ry="132" fill="#e8d9c4" />
      <circle cx="204" cy="276" r="16" fill="#5b6169" />
      <circle cx="308" cy="276" r="16" fill="#5b6169" />
    </svg>
  );
}
