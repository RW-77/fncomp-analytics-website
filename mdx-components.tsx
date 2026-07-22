import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import Image, { type ImageProps } from 'next/image';
import AccuracyDemo from '@/components/docs/accuracy-demo';
import HealthBar from '@/components/docs/health-bar';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    // Serve doc images (PyVista PNG renders) untouched. `unoptimized` skips
    // next/image's WebP re-encode + downscale-to-column, which softened the
    // line art and text. Dimensions and lazy-loading are preserved, so there's
    // no layout shift — we only give up the size/format optimization, which is
    // the right trade for crisp diagrams.
    img: (props) => (
      <Image
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 900px"
        {...(props as ImageProps)}
        unoptimized
        className={['mx-auto block rounded-lg', props.className]
          .filter(Boolean)
          .join(' ')}
        // Sit narrower than the text column but still fill most of it, centered.
        // height:auto keeps the intrinsic aspect ratio. Merge any incoming style
        // last so a specific image can opt out with e.g. style={{ width: '100%' }}.
        style={{ width: '85%', height: 'auto', ...props.style }}
      />
    ),
    // Available in any doc without an import. The heavy three.js bundle sits
    // behind next/dynamic, so pages that don't render it pay nothing.
    AccuracyDemo,
    HealthBar,
    ...components,
  } as MDXComponents;
}
