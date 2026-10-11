import type { Metadata } from 'next';
import { source } from '@/lib/source';
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription
} from 'fumadocs-ui/page'

import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/mdx-components';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) return { title: 'Not found' };
  const title = params.slug?.length ? `${page.data.title} | Docs` : 'Docs: How Every Stat Is Calculated';
  const description =
    page.data.description ??
    'How FNAnalytics calculates every competitive Fortnite stat, with worked examples.';
  return {
    title,
    description,
    alternates: { canonical: page.url },
    openGraph: { title, description, url: page.url, type: 'article' },
  };
}

export function generateStaticParams() {
  return source.generateParams();
}
