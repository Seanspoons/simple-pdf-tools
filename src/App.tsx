import { useEffect, useMemo, useState } from 'react';
import { MergePdfTool } from './components/pdf/MergePdfTool';
import { SplitPdfTool } from './components/pdf/SplitPdfTool';
import mergePdfIcon from './assets/merge-pdf.svg';
import splitPdfIcon from './assets/split-pdf.svg';
import { applyRouteSeo } from './seo';

type AppRoute = '/' | '/merge-pdf' | '/split-pdf' | '/compress-pdf' | '/extract-pages' | '/rotate-pdf';

interface ToolCard {
  path: Exclude<AppRoute, '/'>;
  name: string;
  description: string;
  blurb: string;
  status: 'live' | 'soon';
  icon: 'merge' | 'split' | 'compress' | 'extract' | 'rotate';
}

const LIVE_TOOL_LINKS: Array<{ path: Exclude<AppRoute, '/'>; label: string }> = [
  { path: '/merge-pdf', label: 'Merge PDF' },
  { path: '/split-pdf', label: 'Split PDF' },
  { path: '/compress-pdf', label: 'Compress PDF' },
  { path: '/extract-pages', label: 'Extract Pages' },
  { path: '/rotate-pdf', label: 'Rotate PDF' }
];

const TOOL_CARDS: ToolCard[] = [
  {
    path: '/merge-pdf',
    name: 'Merge PDF',
    description: 'Combine multiple PDF files into a single document.',
    blurb: 'Upload, reorder, and download one merged PDF in your browser.',
    status: 'live',
    icon: 'merge'
  },
  {
    path: '/split-pdf',
    name: 'Split PDF',
    description: 'Break a PDF into smaller files or separate sections.',
    blurb: 'Split out the pages you need from longer PDFs.',
    status: 'live',
    icon: 'split'
  },
  {
    path: '/compress-pdf',
    name: 'Compress PDF',
    description: 'Make PDF files easier to email, upload, and share.',
    blurb: 'A focused tool for reducing PDF size without extra software.',
    status: 'soon',
    icon: 'compress'
  },
  {
    path: '/extract-pages',
    name: 'Extract Pages',
    description: 'Pull selected pages into a new PDF file.',
    blurb: 'Helpful when you only need a few pages from a larger document.',
    status: 'soon',
    icon: 'extract'
  },
  {
    path: '/rotate-pdf',
    name: 'Rotate PDF',
    description: 'Fix sideways scans and mixed page orientation.',
    blurb: 'Built for scanned documents, forms, and exported slide decks.',
    status: 'soon',
    icon: 'rotate'
  }
];

const LIVE_TOOL_CARDS = TOOL_CARDS.filter((tool) => tool.status === 'live');
const COMING_SOON_TOOL_CARDS = TOOL_CARDS.filter((tool) => tool.status === 'soon');

function normalizeRoute(pathname: string): AppRoute {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';

  if (
    cleanPath === '/merge-pdf' ||
    cleanPath === '/split-pdf' ||
    cleanPath === '/compress-pdf' ||
    cleanPath === '/extract-pages' ||
    cleanPath === '/rotate-pdf'
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
  if (kind === 'merge') {
    return (
      <span className={`suite-tool-icon suite-tool-icon-${kind}`} aria-hidden="true">
        <img src={mergePdfIcon} alt="" className="suite-tool-icon-image" />
      </span>
    );
  }

  if (kind === 'split') {
    return (
      <span className={`suite-tool-icon suite-tool-icon-${kind}`} aria-hidden="true">
        <img src={splitPdfIcon} alt="" className="suite-tool-icon-image" />
      </span>
    );
  }

  return (
    <span className={`suite-tool-icon suite-tool-icon-${kind}`} aria-hidden="true">
      <svg viewBox="0 0 72 72" className="suite-tool-icon-svg" focusable="false">
        {kind === 'compress' ? (
          <>
            <path d="M16 13h26l8 8v38H16z" className="icon-surface" strokeLinejoin="round" />
            <path d="M42 13v10h10" className="icon-accent-outline" strokeLinejoin="round" />
            <path d="M26 30h14" className="icon-accent-stroke" />
            <path d="M29 38h8" className="icon-accent-stroke" />
            <path d="M31 46h4" className="icon-accent-stroke" />
          </>
        ) : null}
        {kind === 'extract' ? (
          <>
            <path d="M15 15h22l7 7v33H15z" className="icon-surface" strokeLinejoin="round" />
            <path d="M37 15v9h9" className="icon-accent-outline" strokeLinejoin="round" />
            <path d="M34 34h20" className="icon-accent-stroke" />
            <path d="M41 27l-7 7 7 7" className="icon-accent-stroke" />
            <rect x="47" y="24" width="10" height="21" rx="4" className="icon-accent-soft-fill" />
          </>
        ) : null}
        {kind === 'rotate' ? (
          <>
            <path d="M16 13h26l8 8v38H16z" className="icon-surface" strokeLinejoin="round" />
            <path d="M42 13v10h10" className="icon-accent-outline" strokeLinejoin="round" />
            <path d="M27 45a11 11 0 1 0 0-16" className="icon-accent-stroke" />
            <path d="M23 27v10h10" className="icon-accent-stroke" />
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
    route === '/merge-pdf'
      ? 'Merge PDF'
      : route === '/split-pdf'
        ? 'Split PDF'
        : route === '/compress-pdf'
          ? 'Compress PDF'
          : route === '/extract-pages'
            ? 'Extract Pages'
            : route === '/rotate-pdf'
              ? 'Rotate PDF'
              : 'Simple PDF Tools';

  return (
    <section className="site-intro panel">
      <a
        className="site-intro-link"
        href="https://simplephototools.com"
        target="_blank"
        rel="noreferrer"
      >
        More free tools →
      </a>
      <div className="site-intro-copy">
        <div className="brand-mark" aria-hidden="true">
          <img src={logoUrl} alt="" />
        </div>
        <div>
          <p className="eyebrow">Simple PDF Tools</p>
          <h1>{isHome ? 'Simple PDF tools that stay on your device.' : activeLabel}</h1>
          <p className="hero-copy">
            {isHome
              ? 'Use free online PDF tools right in your browser for merging, splitting, rotating, and organizing documents, with no uploads to our server.'
              : 'Part of Simple PDF Tools: private document tools that run right in your browser.'}
          </p>
        </div>
      </div>
      <div className="tool-switcher tool-switcher-suite" role="navigation" aria-label="Simple PDF Tools">
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
            <div className="tool-menu-panel" role="menu" aria-label="PDF tools">
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
            <button type="button" className="primary-button" onClick={() => onNavigate(tool.path)}>
              Open tool
            </button>
          </article>
        ))}
      </section>

      <details className="panel coming-soon-summary">
        <summary className="coming-soon-summary-toggle">
          <span className="coming-soon-summary-label">Planned tools</span>
          <span className="coming-soon-summary-hint">See what is next</span>
        </summary>
        <div className="coming-soon-summary-body">
          <div className="coming-soon-summary-header">
            <p className="eyebrow">On The Roadmap</p>
            <h2>More PDF tools are on the way.</h2>
            <p className="coming-soon-summary-copy">
              A preview of the next tools planned for Simple PDF Tools.
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
        This tool is planned for Simple PDF Tools, but it is not ready yet.
      </p>
      <div className="coming-soon-actions">
        <button type="button" className="primary-button" onClick={() => onNavigate('/merge-pdf')}>
          Open Merge PDF
        </button>
        <button type="button" className="secondary-button" onClick={() => onNavigate('/')}>
          Go Home
        </button>
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
      case '/merge-pdf':
        return <MergePdfTool />;
      case '/split-pdf':
        return <SplitPdfTool />;
      case '/compress-pdf':
        return <ComingSoonPage toolName="Compress PDF" onNavigate={navigateTo} />;
      case '/extract-pages':
        return <ComingSoonPage toolName="Extract Pages" onNavigate={navigateTo} />;
      case '/rotate-pdf':
        return <ComingSoonPage toolName="Rotate PDF" onNavigate={navigateTo} />;
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
              <p className="site-footer-title">Simple PDF Tools</p>
              <p className="site-footer-copy">
                Free browser-based PDF tools for document cleanup, combining, and privacy, with no
                accounts and no uploads to our server.
              </p>
            </div>
          </div>
          <p className="site-footer-meta">© 2026 Simple PDF Tools. Your files stay on your device.</p>
        </div>
      </footer>
    </div>
  );
}
