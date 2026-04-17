type RouteSeo = {
  title: string;
  description: string;
  canonicalPath: string;
  image: string;
  imageAlt: string;
};

const SITE_URL = 'https://simplepdftools.app';
const DEFAULT_TITLE = 'Simple PDF Tools';
const DEFAULT_DESCRIPTION =
  'Free browser-based PDF tools for merging, splitting, rotating, and organizing documents with no uploads to our server.';

export const ROUTE_SEO: Record<string, RouteSeo> = {
  '/': {
    title: 'Simple PDF Tools | Free Browser-Based PDF Editing and Utility Tools',
    description:
      'Free browser-based PDF tools for merging, splitting, rotating, and organizing documents, with no uploads, no accounts, and no backend.',
    canonicalPath: '/',
    image: `${SITE_URL}/og-home.png`,
    imageAlt: 'Simple PDF Tools homepage preview'
  },
  '/merge-pdf': {
    title: 'Merge PDF | Combine PDF Files in Your Browser',
    description:
      'Merge PDF files in your browser by uploading, reordering, and downloading one combined document with no account required.',
    canonicalPath: '/merge-pdf',
    image: `${SITE_URL}/og-home.png`,
    imageAlt: 'Merge PDF tool preview'
  },
  '/split-pdf': {
    title: 'Split PDF | Break a PDF into Smaller Files in Your Browser',
    description:
      'Split a PDF in your browser by selecting pages, splitting every page, or creating page ranges with no uploads or account required.',
    canonicalPath: '/split-pdf',
    image: `${SITE_URL}/og-home.png`,
    imageAlt: 'Split PDF preview'
  },
  '/compress-pdf': {
    title: 'Compress PDF | Simple PDF Tools',
    description:
      'Compress PDF is planned for Simple PDF Tools. Keep an eye on this route for a browser-based PDF compressor.',
    canonicalPath: '/compress-pdf',
    image: `${SITE_URL}/og-home.png`,
    imageAlt: 'Compress PDF preview'
  },
  '/extract-pages': {
    title: 'Extract Pages | Simple PDF Tools',
    description:
      'Extract Pages is planned for Simple PDF Tools. Keep an eye on this route for a browser-based page extraction tool.',
    canonicalPath: '/extract-pages',
    image: `${SITE_URL}/og-home.png`,
    imageAlt: 'Extract Pages preview'
  },
  '/rotate-pdf': {
    title: 'Rotate PDF | Fix PDF Page Orientation in Your Browser',
    description:
      'Rotate PDF pages in your browser by fixing sideways scans, mixed page orientation, and exported slide decks with no uploads required.',
    canonicalPath: '/rotate-pdf',
    image: `${SITE_URL}/og-home.png`,
    imageAlt: 'Rotate PDF preview'
  }
};

function ensureMeta(selector: string, create: () => HTMLElement): HTMLElement {
  const existing = document.head.querySelector<HTMLElement>(selector);
  if (existing) {
    return existing;
  }

  const element = create();
  document.head.appendChild(element);
  return element;
}

export function applyRouteSeo(route: string) {
  const seo = ROUTE_SEO[route] ?? {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: '/',
    image: `${SITE_URL}/og-home.png`,
    imageAlt: 'Simple PDF Tools homepage preview'
  };
  const url = `${SITE_URL}${seo.canonicalPath}`;

  document.title = seo.title;

  const descriptionMeta = ensureMeta('meta[name="description"]', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'description');
    return meta;
  });
  descriptionMeta.setAttribute('content', seo.description);

  const ogTitle = ensureMeta('meta[property="og:title"]', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', 'og:title');
    return meta;
  });
  ogTitle.setAttribute('content', seo.title);

  const ogDescription = ensureMeta('meta[property="og:description"]', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', 'og:description');
    return meta;
  });
  ogDescription.setAttribute('content', seo.description);

  const ogUrl = ensureMeta('meta[property="og:url"]', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', 'og:url');
    return meta;
  });
  ogUrl.setAttribute('content', url);

  const ogImage = ensureMeta('meta[property="og:image"]', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', 'og:image');
    return meta;
  });
  ogImage.setAttribute('content', seo.image);

  const ogImageAlt = ensureMeta('meta[property="og:image:alt"]', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', 'og:image:alt');
    return meta;
  });
  ogImageAlt.setAttribute('content', seo.imageAlt);

  const twitterTitle = ensureMeta('meta[name="twitter:title"]', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'twitter:title');
    return meta;
  });
  twitterTitle.setAttribute('content', seo.title);

  const twitterDescription = ensureMeta('meta[name="twitter:description"]', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'twitter:description');
    return meta;
  });
  twitterDescription.setAttribute('content', seo.description);

  const twitterImage = ensureMeta('meta[name="twitter:image"]', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'twitter:image');
    return meta;
  });
  twitterImage.setAttribute('content', seo.image);

  const twitterImageAlt = ensureMeta('meta[name="twitter:image:alt"]', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'twitter:image:alt');
    return meta;
  });
  twitterImageAlt.setAttribute('content', seo.imageAlt);

  const canonical = ensureMeta('link[rel="canonical"]', () => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    return link;
  });
  canonical.setAttribute('href', url);
}
