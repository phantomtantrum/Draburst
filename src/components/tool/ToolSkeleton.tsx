/**
 * Suspense fallback with the exact geometry of ToolShell (toolbar 52px,
 * meta 37px, stage) so hydration never shifts the layout.
 */
export function ToolSkeleton({ stageBar = false }: { stageBar?: boolean }) {
  return (
    <div className="mx-auto max-w-[1600px] px-4 lg:px-6" aria-busy="true" aria-label="Loading tool">
      <div className="min-h-[52px] border-b border-rule" />
      <div className="h-[37px] border-b border-rule" />
      <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="hidden lg:block lg:border-r lg:border-rule" />
        <div className="min-w-0 pt-2 lg:pl-6">
          {stageBar && <div className="mb-2 min-h-[34px]" />}
          <div className="relative h-[min(72svh,640px)] w-full overflow-hidden border border-rule bg-black">
            <div className="dither absolute inset-0 text-[var(--qp-gray-800)] opacity-60" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
