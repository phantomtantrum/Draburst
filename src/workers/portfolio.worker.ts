/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import { analyzePortfolio, type PortfolioInput, type PortfolioOutput } from '@/lib/quant/portfolio';

const api = {
  analyze(inp: PortfolioInput): PortfolioOutput {
    const out = analyzePortfolio(inp);
    return Comlink.transfer(out, [out.cloud.weights.buffer, out.cloud.ret.buffer, out.cloud.vol.buffer, out.cloud.sharpe.buffer] as ArrayBuffer[]);
  },
};

export type PortfolioWorkerApi = typeof api;
Comlink.expose(api);
