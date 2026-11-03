import katex from 'katex';
import 'katex/dist/katex.min.css';

/** Server-rendered KaTeX (no client JS). Monochrome via globals.css. */
export function Tex({ children, block = false }: { children: string; block?: boolean }) {
  const html = katex.renderToString(children, { displayMode: block, throwOnError: false, output: 'htmlAndMathml', strict: 'ignore' });
  return block ? (
    <div className="my-4 overflow-x-auto py-1" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}
