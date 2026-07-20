import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import AccuracyDemo from '@/components/docs/accuracy-demo';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    // Available in any doc without an import. The heavy three.js bundle sits
    // behind next/dynamic, so pages that don't render it pay nothing.
    AccuracyDemo,
    ...components,
  } as MDXComponents;
}
