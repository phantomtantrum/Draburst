import Link from 'next/link';
import { Disclaimer } from '@/components/ui/Disclaimer';

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-rule-strong">
      <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-10 md:grid-cols-12 lg:px-6">
        <div className="md:col-span-5">
          <p className="text-[28px] leading-none font-extrabold tracking-[-0.04em] text-fg">quantphantom</p>
          <p className="mt-3 max-w-sm text-[14px] text-muted">
            Quant research tools with real market data. Every number can become a sculpture.
          </p>
        </div>
        <div className="md:col-span-4">
          <p className="label mb-3 text-fg">Data</p>
          <ul className="space-y-1.5 text-[13px] text-muted">
            <li>
              Crypto: <a className="underline underline-offset-2 hover:text-fg" href="https://www.binance.com/en/binance-api" rel="noreferrer" target="_blank">Binance public market data</a> · live
            </li>
            <li>
              Metadata: <a className="underline underline-offset-2 hover:text-fg" href="https://www.coingecko.com/en/api" rel="noreferrer" target="_blank">CoinGecko</a>
            </li>
            <li>
              Stocks &amp; ETFs: <a className="underline underline-offset-2 hover:text-fg" href="https://www.tiingo.com" rel="noreferrer" target="_blank">Tiingo</a> · end-of-day, adjusted
            </li>
          </ul>
        </div>
        <div className="md:col-span-3">
          <p className="label mb-3 text-fg">Index</p>
          <ul className="space-y-1.5 text-[13px] text-muted">
            <li><Link className="hover:text-fg" href="/methodology">Methodology</Link></li>
            <li><Link className="hover:text-fg" href="/methodology#limitations">Limitations</Link></li>
            <li><Link className="hover:text-fg" href="/methodology#terms">Terms &amp; disclaimer</Link></li>
          </ul>
        </div>
        <div className="border-t border-rule pt-6 md:col-span-12">
          <Disclaimer />
        </div>
      </div>
    </footer>
  );
}
