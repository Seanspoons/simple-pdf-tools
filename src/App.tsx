import { useEffect, useMemo, useState } from 'react';
import { CollageMaker } from './components/collage/CollageMaker';
import { BackgroundRemoverTool } from './components/background/BackgroundRemoverTool';
import { ImageCompressorTool } from './components/compressor/ImageCompressorTool';
import { ImageConverterTool } from './components/converter/ImageConverterTool';
import { CropTool } from './components/crop/CropTool';
import { RemoveMetadataTool } from './components/metadata/RemoveMetadataTool';
import { RotateFlipTool } from './components/rotate/RotateFlipTool';
import { SocialMediaFormatterTool } from './components/social/SocialMediaFormatterTool';
import { PhotoResizerTool } from './components/resizer/PhotoResizerTool';
import { applyRouteSeo } from './seo';
import { WatermarkTool } from './components/watermark/WatermarkTool';

type AppRoute =
  | '/'
  | '/watermarker'
  | '/collage'
  | '/resize'
  | '/compress'
  | '/blur'
  | '/border'
  | '/background-remover'
  | '/convert'
  | '/crop'
  | '/rotate'
  | '/rotate-image-online'
  | '/social'
  | '/format-image-for-social-media'
  | '/metadata'
  | '/remove-photo-metadata'
  | '/resize-image-online'
  | '/compress-image-online'
  | '/crop-image-online'
  | '/convert-image-online'
  | '/convert-heic-to-jpg'
  | '/add-watermark-to-photo'
  | '/make-photo-collage-online';

interface ToolCard {
  path: AppRoute;
  name: string;
  description: string;
  blurb: string;
  status: 'live' | 'soon';
  icon:
    | 'watermarker'
    | 'collage'
    | 'resize'
    | 'compress'
    | 'blur'
    | 'border'
    | 'background'
    | 'convert'
    | 'crop'
    | 'rotate'
    | 'social'
    | 'metadata';
}

const LIVE_TOOL_LINKS: Array<{ path: AppRoute; label: string }> = [
  { path: '/watermarker', label: 'Photo Watermarker' },
  { path: '/collage', label: 'Collage Maker' },
  { path: '/background-remover', label: 'Background Remover' },
  { path: '/convert', label: 'Image Converter' },
  { path: '/crop', label: 'Crop Tool' },
  { path: '/resize', label: 'Photo Resizer' },
  { path: '/compress', label: 'Image Compressor' },
  { path: '/rotate', label: 'Rotate / Flip' },
  { path: '/social', label: 'Social Media Formatter' },
  { path: '/metadata', label: 'Remove Metadata' }
];

const TOOL_CARDS: ToolCard[] = [
  {
    path: '/watermarker',
    name: 'Photo Watermarker',
    description: 'Add a text or logo watermark to a photo.',
    blurb: 'Great for artists, creators, and proof images.',
    status: 'live',
    icon: 'watermarker'
  },
  {
    path: '/collage',
    name: 'Collage Maker',
    description: 'Combine multiple photos into one image.',
    blurb: 'Arrange, resize, and save a clean collage.',
    status: 'live',
    icon: 'collage'
  },
  {
    path: '/background-remover',
    name: 'Background Remover',
    description: 'Remove image backgrounds for cleaner cutouts.',
    blurb: 'Helpful for product photos, portraits, and simple graphics.',
    status: 'live',
    icon: 'background'
  },
  {
    path: '/convert',
    name: 'Image Converter',
    description: 'Convert between JPG, PNG, and WebP formats.',
    blurb: 'Helpful when you need a different image type.',
    status: 'live',
    icon: 'convert'
  },
  {
    path: '/crop',
    name: 'Crop Tool',
    description: 'Quickly crop images to the area you want.',
    blurb: 'Useful for cleaner framing and common aspect ratios.',
    status: 'live',
    icon: 'crop'
  },
  {
    path: '/resize',
    name: 'Photo Resizer',
    description: 'Resize photos for sharing and social posts.',
    blurb: 'Useful for Instagram, websites, and email.',
    status: 'live',
    icon: 'resize'
  },
  {
    path: '/compress',
    name: 'Image Compressor',
    description: 'Make image files smaller without extra hassle.',
    blurb: 'Helpful when photos are too large to send or upload.',
    status: 'live',
    icon: 'compress'
  },
  {
    path: '/rotate',
    name: 'Rotate / Flip',
    description: 'Rotate or flip images before saving.',
    blurb: 'Handy for quick fixes before you export.',
    status: 'live',
    icon: 'rotate'
  },
  {
    path: '/social',
    name: 'Social Media Formatter',
    description: 'Format images for Instagram, TikTok, and more.',
    blurb: 'Useful when one photo needs different social sizes.',
    status: 'live',
    icon: 'social'
  },
  {
    path: '/metadata',
    name: 'Metadata Remover',
    description: 'Remove photo details before you share or save.',
    blurb: 'Helpful when you want a cleaner, more private file.',
    status: 'live',
    icon: 'metadata'
  },
  {
    path: '/blur',
    name: 'Blur / Pixelate',
    description: 'Blur or pixelate part of an image before saving.',
    blurb: 'Useful for hiding faces, details, or private information.',
    status: 'soon',
    icon: 'blur'
  },
  {
    path: '/border',
    name: 'Border Maker',
    description: 'Add padding or a simple border around a photo.',
    blurb: 'Useful for product shots and social posts.',
    status: 'soon',
    icon: 'border'
  }
];

const LIVE_TOOL_CARDS = TOOL_CARDS.filter((tool) => tool.status === 'live');
const COMING_SOON_TOOL_CARDS = TOOL_CARDS.filter((tool) => tool.status === 'soon');

function normalizeRoute(pathname: string): AppRoute {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  if (cleanPath === '/watermarker' || cleanPath === '/collage') {
    return cleanPath;
  }

  if (
    cleanPath === '/resize' ||
    cleanPath === '/compress' ||
    cleanPath === '/blur' ||
    cleanPath === '/border' ||
    cleanPath === '/background-remover' ||
    cleanPath === '/convert' ||
    cleanPath === '/crop' ||
    cleanPath === '/rotate' ||
    cleanPath === '/rotate-image-online' ||
    cleanPath === '/social' ||
    cleanPath === '/format-image-for-social-media' ||
    cleanPath === '/metadata' ||
    cleanPath === '/remove-photo-metadata' ||
    cleanPath === '/resize-image-online' ||
    cleanPath === '/compress-image-online' ||
    cleanPath === '/crop-image-online' ||
    cleanPath === '/convert-image-online' ||
    cleanPath === '/convert-heic-to-jpg' ||
    cleanPath === '/add-watermark-to-photo' ||
    cleanPath === '/make-photo-collage-online'
  ) {
    return cleanPath;
  }

  return '/';
}

function resolveRouteFromLocation(locationLike: Pick<Location, 'pathname' | 'search'>): AppRoute {
  const redirectedPath = new URLSearchParams(locationLike.search).get('p');
  return normalizeRoute(redirectedPath || locationLike.pathname);
}

function navigateTo(path: AppRoute) {
  if (window.location.pathname === path) {
    return;
  }

  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function ToolIcon({ kind }: { kind: ToolCard['icon'] }) {
  return (
    <span className={`suite-tool-icon suite-tool-icon-${kind}`} aria-hidden="true">
      <svg viewBox="0 0 72 72" className="suite-tool-icon-svg" focusable="false">
        {kind === 'watermarker' ? (
          <>
            <rect x="13" y="13" width="46" height="46" rx="15" className="icon-surface" />
            <path d="M23 41l8-18 8 18" className="icon-accent-stroke" />
            <path d="M26 34h10" className="icon-accent-stroke" />
            <rect x="36" y="40" width="14" height="7" rx="3.5" className="icon-accent-fill" />
          </>
        ) : null}
        {kind === 'collage' ? (
          <>
            <rect x="12" y="12" width="22" height="22" rx="8" className="icon-surface" />
            <rect x="38" y="12" width="22" height="15" rx="7" className="icon-surface" />
            <rect x="12" y="38" width="15" height="22" rx="7" className="icon-surface" />
            <rect x="31" y="31" width="29" height="29" rx="10" className="icon-accent-soft-fill" />
          </>
        ) : null}
        {kind === 'resize' ? (
          <>
            <rect x="18" y="18" width="36" height="36" rx="12" className="icon-surface" />
            <path d="M31 25h-7v7" className="icon-accent-stroke" />
            <path d="M41 25h7v7" className="icon-accent-stroke" />
            <path d="M31 47h-7v-7" className="icon-accent-stroke" />
            <path d="M41 47h7v-7" className="icon-accent-stroke" />
          </>
        ) : null}
        {kind === 'compress' ? (
          <>
            <rect x="16" y="20" width="40" height="32" rx="11" className="icon-surface" />
            <path d="M27 26v20" className="icon-accent-stroke" />
            <path d="M37 30v12" className="icon-accent-stroke" />
            <path d="M47 34v4" className="icon-accent-stroke" />
          </>
        ) : null}
        {kind === 'blur' ? (
          <>
            <path
              d="M44 14H28C20.268 14 14 20.268 14 28V44C14 51.732 20.268 58 28 58H44C51.732 58 58 51.732 58 44V28C58 20.268 51.732 14 44 14Z"
              fill="white"
              stroke="#D9A24D"
              strokeWidth="2"
            />
            <path
              d="M23 25C24.1046 25 25 24.1046 25 23C25 21.8954 24.1046 21 23 21C21.8954 21 21 21.8954 21 23C21 24.1046 21.8954 25 23 25Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M20 33C21.1046 33 22 32.1046 22 31C22 29.8954 21.1046 29 20 29C18.8954 29 18 29.8954 18 31C18 32.1046 18.8954 33 20 33Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M29 30C30.1046 30 31 29.1046 31 28C31 26.8954 30.1046 26 29 26C27.8954 26 27 26.8954 27 28C27 29.1046 27.8954 30 29 30Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M31 22C32.1046 22 33 21.1046 33 20C33 18.8954 32.1046 18 31 18C29.8954 18 29 18.8954 29 20C29 21.1046 29.8954 22 31 22Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M40 22C41.1046 22 42 21.1046 42 20C42 18.8954 41.1046 18 40 18C38.8954 18 38 18.8954 38 20C38 21.1046 38.8954 22 40 22Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M38 29C39.1046 29 40 28.1046 40 27C40 25.8954 39.1046 25 38 25C36.8954 25 36 25.8954 36 27C36 28.1046 36.8954 29 38 29Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M34 38C35.1046 38 36 37.1046 36 36C36 34.8954 35.1046 34 34 34C32.8954 34 32 34.8954 32 36C32 37.1046 32.8954 38 34 38Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M26 39C27.1046 39 28 38.1046 28 37C28 35.8954 27.1046 35 26 35C24.8954 35 24 35.8954 24 37C24 38.1046 24.8954 39 26 39Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M19 44C20.1046 44 21 43.1046 21 42C21 40.8954 20.1046 40 19 40C17.8954 40 17 40.8954 17 42C17 43.1046 17.8954 44 19 44Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M23 52C24.1046 52 25 51.1046 25 50C25 48.8954 24.1046 48 23 48C21.8954 48 21 48.8954 21 50C21 51.1046 21.8954 52 23 52Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M29 47C30.1046 47 31 46.1046 31 45C31 43.8954 30.1046 43 29 43C27.8954 43 27 43.8954 27 45C27 46.1046 27.8954 47 29 47Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M31 55C32.1046 55 33 54.1046 33 53C33 51.8954 32.1046 51 31 51C29.8954 51 29 51.8954 29 53C29 54.1046 29.8954 55 31 55Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M37 46C38.1046 46 39 45.1046 39 44C39 42.8954 38.1046 42 37 42C35.8954 42 35 42.8954 35 44C35 45.1046 35.8954 46 37 46Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M40 54C41.1046 54 42 53.1046 42 52C42 50.8954 41.1046 50 40 50C38.8954 50 38 50.8954 38 52C38 53.1046 38.8954 54 40 54Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M48 51C49.1046 51 50 50.1046 50 49C50 47.8954 49.1046 47 48 47C46.8954 47 46 47.8954 46 49C46 50.1046 46.8954 51 48 51Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M44 44C45.1046 44 46 43.1046 46 42C46 40.8954 45.1046 40 44 40C42.8954 40 42 40.8954 42 42C42 43.1046 42.8954 44 44 44Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M42 37C43.1046 37 44 36.1046 44 35C44 33.8954 43.1046 33 42 33C40.8954 33 40 33.8954 40 35C40 36.1046 40.8954 37 42 37Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M46 29C47.1046 29 48 28.1046 48 27C48 25.8954 47.1046 25 46 25C44.8954 25 44 25.8954 44 27C44 28.1046 44.8954 29 46 29Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M48 22C49.1046 22 50 21.1046 50 20C50 18.8954 49.1046 18 48 18C46.8954 18 46 18.8954 46 20C46 21.1046 46.8954 22 48 22Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M53 29C54.1046 29 55 28.1046 55 27C55 25.8954 54.1046 25 53 25C51.8954 25 51 25.8954 51 27C51 28.1046 51.8954 29 53 29Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M50 36C51.1046 36 52 35.1046 52 34C52 32.8954 51.1046 32 50 32C48.8954 32 48 32.8954 48 34C48 35.1046 48.8954 36 50 36Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M53 44C54.1046 44 55 43.1046 55 42C55 40.8954 54.1046 40 53 40C51.8954 40 51 40.8954 51 42C51 43.1046 51.8954 44 53 44Z"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
          </>
        ) : null}
        {kind === 'convert' ? (
          <>
            <path
              d="M11 12H22L26 16V34H11V12Z"
              className="icon-surface"
              strokeLinejoin="round"
            />
            <path d="M21 12V18H27" className="icon-accent-outline" strokeLinejoin="round" />
            <path
              d="M44 38H55L59 42V60H44V38Z"
              className="icon-surface-strong"
              strokeLinejoin="round"
            />
            <path d="M54 38V44H60" className="icon-accent-outline" strokeLinejoin="round" />
            <path
              d="M34 14C37.8928 14.4137 41.5786 15.9608 44.6005 18.4494C47.6224 20.938 49.8475 24.2588 51 28"
              className="icon-accent-stroke"
            />
            <path d="M52.9514 22.8276L51.3305 31.5811L46.1951 25.4436" className="icon-accent-stroke" />
            <path
              d="M37 56C33.1072 55.5863 29.4214 54.0392 26.3995 51.5506C23.3776 49.062 21.1525 45.7412 20 42"
              className="icon-accent-stroke"
            />
            <path d="M18.0166 47.8693L18.7819 39L24.4876 44.6111" className="icon-accent-stroke" />
          </>
        ) : null}
        {kind === 'crop' ? (
          <>
            <path
              d="M24 18v26a2.5 2.5 0 0 0 2.5 2.5H54"
              className="icon-accent-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M18 26h26a2.5 2.5 0 0 1 2.5 2.5V54"
              className="icon-accent-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}
        {kind === 'rotate' ? (
          <>
            <path d="M24 26a16 16 0 1 1-2 21" className="icon-accent-stroke" />
            <path d="M19 20v11h11" className="icon-accent-stroke" />
          </>
        ) : null}
        {kind === 'social' ? (
          <>
            <path
              d="M24 18H22C17.5817 18 14 21.5817 14 26V42C14 46.4183 17.5817 50 22 50H24C28.4183 50 32 46.4183 32 42V26C32 21.5817 28.4183 18 24 18Z"
              className="icon-surface"
            />
            <path
              d="M50 14H46C42.134 14 39 17.134 39 21V25C39 28.866 42.134 32 46 32H50C53.866 32 57 28.866 57 25V21C57 17.134 53.866 14 50 14Z"
              className="icon-accent-soft-fill"
            />
            <path
              d="M52 38H44C39.5817 38 36 41.5817 36 46V50C36 54.4183 39.5817 58 44 58H52C56.4183 58 60 54.4183 60 50V46C60 41.5817 56.4183 38 52 38Z"
              className="icon-surface-strong"
            />
            <path d="M32 34L40 28" className="icon-accent-stroke" />
            <path d="M32 42L36 44" className="icon-accent-stroke" />
          </>
        ) : null}
        {kind === 'metadata' ? (
          <>
            <path
              d="M40 15H32C25.9249 15 21 19.9249 21 26V46C21 52.0751 25.9249 57 32 57H40C46.0751 57 51 52.0751 51 46V26C51 19.9249 46.0751 15 40 15Z"
              className="icon-surface"
            />
            <path d="M43 29L29 43" className="icon-accent-stroke" />
            <path d="M29 29L43 43" className="icon-accent-stroke" />
          </>
        ) : null}
        {kind === 'border' ? (
          <>
            <rect x="11" y="11" width="50" height="50" rx="17" className="icon-accent-soft-fill" />
            <rect x="19" y="19" width="34" height="34" rx="11" className="icon-surface-strong" />
            <rect x="25" y="25" width="22" height="22" rx="7" className="icon-surface" />
          </>
        ) : null}
        {kind === 'background' ? (
          <>
            <path
              d="M44 12H28C19.1634 12 12 19.1634 12 28V44C12 52.8366 19.1634 60 28 60H44C52.8366 60 60 52.8366 60 44V28C60 19.1634 52.8366 12 44 12Z"
              fill="white"
              stroke="#D9A24D"
              strokeWidth="2"
            />
            <rect
              x="21.75"
              y="22.75"
              width="27.5"
              height="27.5"
              rx="4.25"
              fill="#D9A24D"
              fillOpacity="0.35"
              stroke="#D9A24D"
              strokeWidth="1.5"
            />
            <path
              d="M24 29.813L28.2605 25.0783"
              stroke="#D9A24D"
              strokeOpacity="0.65"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M25 34L33.2605 25.0783"
              stroke="#D9A24D"
              strokeOpacity="0.65"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M25 39.813L38 25"
              stroke="#D9A24D"
              strokeOpacity="0.65"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M29 47.0518L46 27"
              stroke="#D9A24D"
              strokeOpacity="0.65"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M34 47.3639L47 32"
              stroke="#D9A24D"
              strokeOpacity="0.65"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M39 47.6025L47 38"
              stroke="#D9A24D"
              strokeOpacity="0.65"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M44 47.7494L47 44"
              stroke="#D9A24D"
              strokeOpacity="0.65"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M25 46L43 25.2388"
              stroke="#D9A24D"
              strokeOpacity="0.65"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M22 22L50 50"
              stroke="#D9A24D"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </>
        ) : null}
      </svg>
    </span>
  );
}

function RouteIntro({
  route,
  onNavigate
}: {
  route: AppRoute;
  onNavigate: (path: AppRoute) => void;
}) {
  const logoUrl = `${import.meta.env.BASE_URL}icon.svg`;
  const isHome = route === '/';
  const [isToolMenuOpen, setIsToolMenuOpen] = useState(false);
  const activeLabel =
    route === '/watermarker' || route === '/add-watermark-to-photo'
      ? 'Photo Watermarker'
      : route === '/collage' || route === '/make-photo-collage-online'
        ? 'Collage Maker'
        : route === '/convert' || route === '/convert-heic-to-jpg'
          || route === '/convert-image-online'
          ? 'Image Converter'
          : route === '/resize'
            || route === '/resize-image-online'
            ? 'Photo Resizer'
            : route === '/compress'
              || route === '/compress-image-online'
              ? 'Image Compressor'
              : route === '/crop' || route === '/crop-image-online'
                ? 'Crop Tool'
                : route === '/metadata' || route === '/remove-photo-metadata'
                  ? 'Remove Metadata'
                  : route === '/background-remover'
                    ? 'Background Remover'
                    : route === '/rotate'
                    ? 'Rotate / Flip'
                    : route === '/social' || route === '/format-image-for-social-media'
                      ? 'Social Media Formatter'
        : 'Coming Soon';

  return (
    <section className="site-intro panel">
      <div className="site-intro-copy">
        <div className="brand-mark" aria-hidden="true">
          <img src={logoUrl} alt="" />
        </div>
        <div>
          <p className="eyebrow">Simple Photo Tools</p>
          <h1>{isHome ? 'Simple photo tools that stay on your device.' : activeLabel}</h1>
          <p className="hero-copy">
            {isHome
              ? 'Use free online photo tools right in your browser for watermarking, collages, resizing, conversion, compression, cropping, and more, with no uploads to our server.'
              : 'Part of Simple Photo Tools: private photo tools that run right in your browser.'}
          </p>
        </div>
      </div>
      <div className="tool-switcher tool-switcher-suite" role="navigation" aria-label="Simple Photo Tools">
        <button
          type="button"
          className={`tool-switch-button ${route === '/' ? 'is-active' : ''}`}
          onClick={() => onNavigate('/')}
        >
          Home
        </button>
        <div className="tool-menu">
          <button
            type="button"
            className={`tool-switch-button tool-menu-trigger ${!isHome ? 'is-active' : ''}`}
            aria-expanded={isToolMenuOpen}
            aria-haspopup="menu"
            onClick={() => setIsToolMenuOpen((current) => !current)}
          >
            <span>All Tools</span>
            <span className={`tool-menu-chevron ${isToolMenuOpen ? 'is-open' : ''}`} aria-hidden="true">
              ▾
            </span>
          </button>
          {isToolMenuOpen ? (
            <div className="tool-menu-panel" role="menu" aria-label="Live tools">
              {LIVE_TOOL_LINKS.map((tool) => (
                <button
                  key={tool.path}
                  type="button"
                  role="menuitem"
                  className={`tool-menu-item ${route === tool.path ? 'is-active' : ''}`}
                  onClick={() => {
                    setIsToolMenuOpen(false);
                    onNavigate(tool.path);
                  }}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function HomePage({ onNavigate }: { onNavigate: (path: AppRoute) => void }) {
  return (
    <>
      <section className="suite-grid">
        {LIVE_TOOL_CARDS.map((tool) => (
          <article key={tool.path} className="panel suite-card">
            <div className="suite-card-header">
              <div className="suite-card-title">
                <ToolIcon kind={tool.icon} />
                <h2>{tool.name}</h2>
              </div>
            </div>
            <p className="suite-card-copy">{tool.description}</p>
            <p className="suite-card-blurb">{tool.blurb}</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => onNavigate(tool.path)}
            >
              Open tool
            </button>
          </article>
        ))}
      </section>

      {COMING_SOON_TOOL_CARDS.length > 0 ? (
        <details className="panel coming-soon-summary">
          <summary className="coming-soon-summary-toggle">
            <span className="coming-soon-summary-label">Planned tools</span>
            <span className="coming-soon-summary-hint">See what is next</span>
          </summary>
          <div className="coming-soon-summary-body">
            <div className="coming-soon-summary-header">
              <p className="eyebrow">On The Roadmap</p>
              <h2>More photo tools are on the way.</h2>
              <p className="coming-soon-summary-copy">
                A preview of the next tools planned for Simple Photo Tools.
              </p>
            </div>
            <div className="coming-soon-preview-grid">
              {COMING_SOON_TOOL_CARDS.map((tool) => (
                <article key={tool.path} className="coming-soon-preview-card">
                  <ToolIcon kind={tool.icon} />
                  <div className="coming-soon-preview-copy">
                    <h3>{tool.name}</h3>
                    <p>{tool.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </details>
      ) : null}
    </>
  );
}

function ComingSoonPage({
  toolName,
  onNavigate
}: {
  toolName: string;
  onNavigate: (path: AppRoute) => void;
}) {
  return (
    <section className="panel coming-soon-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Coming Soon</p>
          <h2>{toolName}</h2>
        </div>
      </div>
      <p className="hero-copy">
        This tool is planned for Simple Photo Tools, but it is not ready yet.
      </p>
      <div className="coming-soon-actions">
        <button type="button" className="primary-button" onClick={() => onNavigate('/watermarker')}>
          Open Watermarker
        </button>
        <button type="button" className="secondary-button" onClick={() => onNavigate('/collage')}>
          Open Collage Maker
        </button>
      </div>
    </section>
  );
}

function LandingPage({
  eyebrow,
  title,
  copy,
  bulletA,
  bulletB,
  bulletC,
  ctaLabel,
  ctaPath,
  secondaryLabel,
  secondaryPath,
  onNavigate
}: {
  eyebrow: string;
  title: string;
  copy: string;
  bulletA: string;
  bulletB: string;
  bulletC: string;
  ctaLabel: string;
  ctaPath: AppRoute;
  secondaryLabel: string;
  secondaryPath: AppRoute;
  onNavigate: (path: AppRoute) => void;
}) {
  return (
    <section className="hero">
      <div className="hero-copy-block">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="hero-copy">{copy}</p>
          <div className="hero-tags" aria-label="Highlights">
            <span className="hero-tag">{bulletA}</span>
            <span className="hero-tag">{bulletB}</span>
            <span className="hero-tag">{bulletC}</span>
          </div>
        </div>
      </div>
      <div className="hero-card">
        <p className="hero-stat-label">Start here</p>
        <p className="hero-stat">Use the matching tool right in your browser.</p>
        <div className="coming-soon-actions">
          <button type="button" className="primary-button" onClick={() => onNavigate(ctaPath)}>
            {ctaLabel}
          </button>
          <button type="button" className="secondary-button" onClick={() => onNavigate(secondaryPath)}>
            {secondaryLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const logoUrl = `${import.meta.env.BASE_URL}icon.svg`;
  const [route, setRoute] = useState<AppRoute>(() => resolveRouteFromLocation(window.location));

  useEffect(() => {
    const redirectedPath = new URLSearchParams(window.location.search).get('p');
    if (redirectedPath) {
      const normalizedPath = normalizeRoute(redirectedPath);
      window.history.replaceState({}, '', normalizedPath);
      setRoute(normalizedPath);
    }

    const handleLocationChange = () => {
      setRoute(resolveRouteFromLocation(window.location));
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  useEffect(() => {
    applyRouteSeo(route);
  }, [route]);

  const routeContent = useMemo(() => {
    switch (route) {
      case '/watermarker':
        return <WatermarkTool />;
      case '/collage':
        return <CollageMaker />;
      case '/resize':
        return <PhotoResizerTool />;
      case '/compress':
        return <ImageCompressorTool />;
      case '/convert':
        return <ImageConverterTool />;
      case '/convert-heic-to-jpg':
        return (
          <LandingPage
            eyebrow="Convert HEIC to JPG"
            title="Convert HEIC photos to JPG without uploading them."
            copy="Open HEIC or HEIF images, switch the output to JPEG, and save a new browser-based copy in just a few taps."
            bulletA="HEIC and HEIF input"
            bulletB="JPG output"
            bulletC="Private in browser"
            ctaLabel="Open Image Converter"
            ctaPath="/convert"
            secondaryLabel="Go Home"
            secondaryPath="/"
            onNavigate={navigateTo}
          />
        );
      case '/convert-image-online':
        return (
          <LandingPage
            eyebrow="Convert Image Online"
            title="Convert an image online without sending it to a server."
            copy="Open common image formats, switch to JPEG, PNG, or WebP, and save a converted file right in your browser."
            bulletA="JPEG, PNG, and WebP"
            bulletB="HEIC and HEIF input"
            bulletC="Private in browser"
            ctaLabel="Open Image Converter"
            ctaPath="/convert"
            secondaryLabel="Go Home"
            secondaryPath="/"
            onNavigate={navigateTo}
          />
        );
      case '/resize-image-online':
        return (
          <LandingPage
            eyebrow="Resize Image Online"
            title="Resize an image online without uploading it anywhere."
            copy="Set a new width and height, keep the aspect ratio locked when you want to, and save a resized image right in your browser."
            bulletA="Width and height"
            bulletB="Aspect ratio lock"
            bulletC="Private in browser"
            ctaLabel="Open Photo Resizer"
            ctaPath="/resize"
            secondaryLabel="Go Home"
            secondaryPath="/"
            onNavigate={navigateTo}
          />
        );
      case '/compress-image-online':
        return (
          <LandingPage
            eyebrow="Compress Image Online"
            title="Compress an image online to make the file smaller."
            copy="Lower image file size with simple browser-based controls for JPEG, PNG, and WebP without sending your photo to a server."
            bulletA="Smaller file sizes"
            bulletB="Simple quality controls"
            bulletC="Private in browser"
            ctaLabel="Open Image Compressor"
            ctaPath="/compress"
            secondaryLabel="Go Home"
            secondaryPath="/"
            onNavigate={navigateTo}
          />
        );
      case '/crop-image-online':
        return (
          <LandingPage
            eyebrow="Crop Image Online"
            title="Crop an image online and keep only the part you want."
            copy="Drag the crop box, use a fixed ratio if you want one, and save the cropped result right in your browser."
            bulletA="Drag to crop"
            bulletB="Fixed ratios or free crop"
            bulletC="Private in browser"
            ctaLabel="Open Crop Tool"
            ctaPath="/crop"
            secondaryLabel="Go Home"
            secondaryPath="/"
            onNavigate={navigateTo}
          />
        );
      case '/rotate-image-online':
        return (
          <LandingPage
            eyebrow="Rotate Image Online"
            title="Rotate or flip an image online without a full editor."
            copy="Use simple 90° rotate and mirror controls, preview the result live, and save the final image right in your browser."
            bulletA="Rotate left or right"
            bulletB="Flip horizontal or vertical"
            bulletC="Private in browser"
            ctaLabel="Open Rotate / Flip"
            ctaPath="/rotate"
            secondaryLabel="Go Home"
            secondaryPath="/"
            onNavigate={navigateTo}
          />
        );
      case '/format-image-for-social-media':
        return (
          <LandingPage
            eyebrow="Format Image for Social Media"
            title="Format an image for social media without a full design editor."
            copy="Pick a ready-made preset for Instagram, TikTok, LinkedIn, X, and more, then fit or fill the canvas and save the final image right in your browser."
            bulletA="Social presets"
            bulletB="Fit or fill"
            bulletC="Private in browser"
            ctaLabel="Open Social Media Formatter"
            ctaPath="/social"
            secondaryLabel="Go Home"
            secondaryPath="/"
            onNavigate={navigateTo}
          />
        );
      case '/add-watermark-to-photo':
        return (
          <LandingPage
            eyebrow="Add Watermark to Photo"
            title="Add a text or logo watermark to a photo online."
            copy="Use the built-in watermarker to add text, logo, or proof-style marks right in your browser with no uploads to our server."
            bulletA="Text or logo"
            bulletB="Proof pattern"
            bulletC="Private in browser"
            ctaLabel="Open Watermarker"
            ctaPath="/watermarker"
            secondaryLabel="Go Home"
            secondaryPath="/"
            onNavigate={navigateTo}
          />
        );
      case '/remove-photo-metadata':
        return (
          <LandingPage
            eyebrow="Remove Photo Metadata"
            title="Remove photo metadata before you share an image."
            copy="Review hidden details like camera, date, and location data, then save a cleaned copy right in your browser."
            bulletA="Metadata review"
            bulletB="Privacy focused"
            bulletC="Private in browser"
            ctaLabel="Open Remove Metadata"
            ctaPath="/metadata"
            secondaryLabel="Go Home"
            secondaryPath="/"
            onNavigate={navigateTo}
          />
        );
      case '/make-photo-collage-online':
        return (
          <LandingPage
            eyebrow="Make Photo Collage Online"
            title="Make a photo collage online without a cluttered editor."
            copy="Upload your photos, arrange them directly in the preview, and export a clean collage right in your browser."
            bulletA="Drag to arrange"
            bulletB="Resize tiles"
            bulletC="Private in browser"
            ctaLabel="Open Collage Maker"
            ctaPath="/collage"
            secondaryLabel="Go Home"
            secondaryPath="/"
            onNavigate={navigateTo}
          />
        );
      case '/crop':
        return <CropTool />;
      case '/rotate':
        return <RotateFlipTool />;
      case '/social':
        return <SocialMediaFormatterTool />;
      case '/blur':
        return <ComingSoonPage toolName="Blur / Pixelate" onNavigate={navigateTo} />;
      case '/metadata':
        return <RemoveMetadataTool />;
      case '/background-remover':
        return <BackgroundRemoverTool />;
      case '/border':
        return <ComingSoonPage toolName="Border Maker" onNavigate={navigateTo} />;
      default:
        return <HomePage onNavigate={navigateTo} />;
    }
  }, [route]);

  return (
    <div className="app-shell">
      <main className="app">
        <RouteIntro route={route} onNavigate={navigateTo} />
        {routeContent}
      </main>

      <footer className="site-footer">
        <div className="site-footer-card">
          <div className="site-footer-brand">
            <img src={logoUrl} alt="" aria-hidden="true" />
            <div>
              <p className="site-footer-title">Simple Photo Tools</p>
              <p className="site-footer-copy">
                Free browser-based photo tools for editing, formatting, and privacy, with no
                accounts and no uploads to our server.
              </p>
            </div>
          </div>
          <p className="site-footer-meta">
            © 2026 Simple Photo Tools. Your edits stay on your device.
          </p>
        </div>
      </footer>
    </div>
  );
}
