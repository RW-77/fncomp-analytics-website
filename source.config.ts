import { defineDocs, defineConfig } from 'fumadocs-mdx/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export const docs = defineDocs({
  dir: 'content/docs',
});

export default defineConfig({
  mdxOptions: {
    // remarkMath must run first, before the syntax highlighter gets a chance
    // to treat a math block as code.
    remarkPlugins: [remarkMath],
    rehypePlugins: (v) => [rehypeKatex, ...v],
    // Search index config. By default remark-structure indexes any *leaf* MDX
    // element as a content block, which serialized our self-closing <Card /> and
    // <AccuracyDemo /> tags (attributes and all) into search results. Returning
    // false stops leaf components from being indexed; text inside container
    // components (e.g. <Callout>...</Callout>) is still indexed via its children.
    remarkStructureOptions: {
      mdxTypes: () => false,
    },
  },
});
