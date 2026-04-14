type RouteSeo = {
  title: string;
  description: string;
  canonicalPath: string;
  image: string;
  imageAlt: string;
};

const DEFAULT_TITLE = 'Simple Photo Tools';
const DEFAULT_DESCRIPTION =
  'Free browser-based photo tools for watermarking, collages, and image conversion, with no uploads to our server.';

export const ROUTE_SEO: Record<string, RouteSeo> = {
  '/': {
    title: 'Simple Photo Tools | Free Browser-Based Photo Editing and Utility Tools',
    description:
      'Free browser-based photo tools for watermarking, collages, resizing, compression, and image conversion, with no uploads, no accounts, and no backend.',
    canonicalPath: '/',
    image: 'https://simplephototools.com/og-home.png',
    imageAlt: 'Simple Photo Tools homepage preview'
  },
  '/watermarker': {
    title: 'Photo Watermarker | Add Text, Logo, or Proof Watermarks in Your Browser',
    description:
      'Add text, logo, or proof-style watermarks to photos right in your browser with private client-side editing and simple export controls.',
    canonicalPath: '/watermarker',
    image: 'https://simplephototools.com/og-watermarker.png',
    imageAlt: 'Photo Watermarker preview card'
  },
  '/collage': {
    title: 'Collage Maker | Create Clean Photo Collages in Your Browser',
    description:
      'Make clean photo collages in your browser with drag-to-arrange tiles, resize controls, and private client-side export that stays on your device.',
    canonicalPath: '/collage',
    image: 'https://simplephototools.com/og-collage.png',
    imageAlt: 'Collage Maker preview card'
  },
  '/convert': {
    title: 'Image Converter | Convert JPG, PNG, and WebP Images in Your Browser',
    description:
      'Convert images between JPG, PNG, and WebP in your browser, and open HEIC, HEIF, GIF, BMP, AVIF, and SVG files locally with no uploads.',
    canonicalPath: '/convert',
    image: 'https://simplephototools.com/og-convert.png',
    imageAlt: 'Image Converter preview card'
  },
  '/resize': {
    title: 'Photo Resizer | Resize Images for Social Posts, Websites, and Email',
    description:
      'Resize images for social posts, websites, and email right in your browser with width, height, and aspect ratio controls that stay private on your device.',
    canonicalPath: '/resize',
    image: 'https://simplephototools.com/og-resizer.png',
    imageAlt: 'Photo Resizer tool preview card'
  },
  '/compress': {
    title: 'Image Compressor | Make JPEG, PNG, and WebP Files Smaller in Your Browser',
    description:
      'Make JPEG, PNG, and WebP image files smaller in your browser with simple quality controls, private processing, and no account required.',
    canonicalPath: '/compress',
    image: 'https://simplephototools.com/og-compressor.png',
    imageAlt: 'Image Compressor tool preview card'
  },
  '/crop': {
    title: 'Crop Tool | Crop Images in Your Browser with Free or Fixed Ratios',
    description:
      'Crop images in your browser with a simple drag-and-resize crop box, aspect ratio presets, and private client-side export.',
    canonicalPath: '/crop',
    image: 'https://simplephototools.com/og-crop.png',
    imageAlt: 'Crop Tool preview card'
  },
  '/rotate': {
    title: 'Rotate / Flip | Rotate or Flip Images in Your Browser',
    description:
      'Rotate or flip images in your browser with simple 90° controls, live preview, and private client-side export.',
    canonicalPath: '/rotate',
    image: 'https://simplephototools.com/og-rotate.png',
    imageAlt: 'Rotate Flip tool preview card'
  },
  '/social': {
    title: 'Social Media Formatter | Format Images for Instagram, TikTok, LinkedIn, and X',
    description:
      'Format images for Instagram, TikTok, LinkedIn, X, and more with simple presets, fit or fill controls, padding, and private browser-based export.',
    canonicalPath: '/social',
    image: 'https://simplephototools.com/og-social.png',
    imageAlt: 'Social Media Formatter tool preview card'
  },
  '/metadata': {
    title: 'Remove Metadata | Strip Hidden Photo Details in Your Browser',
    description:
      'Review and remove hidden photo metadata like location, camera, and capture details right in your browser with private client-side export.',
    canonicalPath: '/metadata',
    image: 'https://simplephototools.com/og-metadata.png',
    imageAlt: 'Remove Metadata tool preview card'
  },
  '/background-remover': {
    title: 'Background Remover | Remove Photo Backgrounds in Your Browser',
    description:
      'Remove photo backgrounds directly in your browser and download a transparent cutout with private client-side processing and no uploads.',
    canonicalPath: '/background-remover',
    image: 'https://simplephototools.com/og-home.png',
    imageAlt: 'Background Remover tool preview card'
  },
  '/resize-image-online': {
    title: 'Resize Image Online | Free Browser-Based Photo Resizer',
    description:
      'Resize an image online in your browser with width, height, and aspect ratio controls, with no uploads and no account required.',
    canonicalPath: '/resize-image-online',
    image: 'https://simplephototools.com/og-resizer.png',
    imageAlt: 'Resize image online landing page preview'
  },
  '/compress-image-online': {
    title: 'Compress Image Online | Free Browser-Based Image Compressor',
    description:
      'Compress an image online in your browser to make the file smaller with simple JPEG, PNG, and WebP export options.',
    canonicalPath: '/compress-image-online',
    image: 'https://simplephototools.com/og-compressor.png',
    imageAlt: 'Compress image online landing page preview'
  },
  '/crop-image-online': {
    title: 'Crop Image Online | Free Browser-Based Crop Tool',
    description:
      'Crop an image online in your browser with a drag-and-resize crop box, simple aspect ratio presets, and private export.',
    canonicalPath: '/crop-image-online',
    image: 'https://simplephototools.com/og-crop.png',
    imageAlt: 'Crop image online landing page preview'
  },
  '/rotate-image-online': {
    title: 'Rotate Image Online | Free Browser-Based Rotate and Flip Tool',
    description:
      'Rotate an image online in your browser with simple 90° controls, horizontal or vertical flip options, and private export.',
    canonicalPath: '/rotate-image-online',
    image: 'https://simplephototools.com/og-rotate.png',
    imageAlt: 'Rotate image online landing page preview'
  },
  '/format-image-for-social-media': {
    title: 'Format Image for Social Media | Free Browser-Based Social Media Formatter',
    description:
      'Format an image for social media in your browser with presets for Instagram, TikTok, LinkedIn, X, and more, with fit or fill controls and private export.',
    canonicalPath: '/format-image-for-social-media',
    image: 'https://simplephototools.com/og-social.png',
    imageAlt: 'Format image for social media landing page preview'
  },
  '/convert-image-online': {
    title: 'Convert Image Online | Free Browser-Based Image Converter',
    description:
      'Convert an image online in your browser between JPEG, PNG, and WebP, with support for common input formats and no uploads.',
    canonicalPath: '/convert-image-online',
    image: 'https://simplephototools.com/og-convert.png',
    imageAlt: 'Convert image online landing page preview'
  },
  '/convert-heic-to-jpg': {
    title: 'Convert HEIC to JPG | Free Browser-Based Image Converter',
    description:
      'Convert HEIC and HEIF photos to JPG right in your browser with no uploads, no accounts, and no backend.',
    canonicalPath: '/convert-heic-to-jpg',
    image: 'https://simplephototools.com/og-convert.png',
    imageAlt: 'Convert HEIC to JPG landing page preview'
  },
  '/add-watermark-to-photo': {
    title: 'Add Watermark to Photo | Free Browser-Based Watermarker',
    description:
      'Add a text, logo, or proof watermark to a photo online in your browser, with no uploads and no account required.',
    canonicalPath: '/add-watermark-to-photo',
    image: 'https://simplephototools.com/og-watermarker.png',
    imageAlt: 'Add watermark to photo landing page preview'
  },
  '/remove-photo-metadata': {
    title: 'Remove Photo Metadata | Free Browser-Based Metadata Cleaner',
    description:
      'Remove photo metadata in your browser, including location, camera, and capture details, and save a cleaned copy with no uploads.',
    canonicalPath: '/remove-photo-metadata',
    image: 'https://simplephototools.com/og-metadata.png',
    imageAlt: 'Remove photo metadata landing page preview'
  },
  '/make-photo-collage-online': {
    title: 'Make Photo Collage Online | Free Browser-Based Collage Maker',
    description:
      'Make a photo collage online in your browser with drag-to-arrange tiles, resize controls, and private local export.',
    canonicalPath: '/make-photo-collage-online',
    image: 'https://simplephototools.com/og-collage.png',
    imageAlt: 'Make photo collage online landing page preview'
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
    image: 'https://simplephototools.com/og-home.png',
    imageAlt: 'Simple Photo Tools homepage preview'
  };
  const url = `https://simplephototools.com${seo.canonicalPath}`;

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
