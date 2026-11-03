/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import { simulate, type McBatch, type McParams, type McSummary } from '@/lib/quant/montecarlo';

/**
 * Monte Carlo runs off the main thread. Each batch is posted back with its
 * typed arrays TRANSFERRED (zero-copy). The caller awaits each callback,
 * which gives natural back-pressure.
 */
const api = {
  async run(p: McParams, onBatch: (b: McBatch) => Promise<void> | void): Promise<McSummary> {
    const it = simulate(p);
    for (;;) {
      const r = it.next();
      if (r.done) {
        const s = r.value;
        return Comlink.transfer(s, [s.terminalSorted.buffer, s.meanPath.buffer, s.grid.buffer, ...s.bands.map((b) => b.buffer as ArrayBuffer)]);
      }
      const b = r.value;
      await onBatch(Comlink.transfer(b, [b.display.buffer, b.displayTerminal.buffer]));
    }
  },
};

export type McWorkerApi = typeof api;
Comlink.expose(api);
