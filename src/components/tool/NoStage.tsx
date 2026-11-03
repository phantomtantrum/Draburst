import { Button } from '@/components/ui/Button';

/** 2D-only notice when WebGL is missing or CPU-rasterized. Same geometry as the stage. */
export function NoStage({ software, onForce }: { software: boolean; onForce: () => void }) {
  return (
    <div className="relative flex h-[min(72svh,640px)] w-full flex-col items-center justify-center gap-4 overflow-hidden border border-rule bg-black px-6 text-center">
      <div className="dither absolute inset-0 text-[var(--qp-gray-800)] opacity-60" aria-hidden />
      <p className="label relative text-muted" role="status">
        {software ? '3D OFF — NO HARDWARE GRAPHICS ACCELERATION · SAME DATA IN 2D BELOW' : 'WEBGL UNAVAILABLE — SAME DATA IN 2D BELOW'}
      </p>
      {software && (
        <Button variant="secondary" size="sm" className="relative" onClick={onForce}>
          Render 3D anyway (slow)
        </Button>
      )}
    </div>
  );
}
