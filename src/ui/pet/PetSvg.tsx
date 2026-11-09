import { accessoryBox, type AccessoryId, type Stage } from './geometry';

/** Stage art plus equipped accessory overlays positioned by the stage's anchors (T110/T111). */
export function PetSvg({ stage, accessories = [], size = 160, bounce }: { stage: Stage; accessories?: string[]; size?: number; bounce?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={stage} className={bounce ? 'pet-bounce' : undefined}>
      <image href={`/pet/stage-${stage}.svg`} width="200" height="200" />
      {accessories.map((id) => {
        const b = accessoryBox(stage, id as AccessoryId);
        return <image key={id} href={`/pet/acc-${id}.svg`} x={b.x} y={b.y} width={b.w} height={b.h} preserveAspectRatio="none" />;
      })}
    </svg>
  );
}
