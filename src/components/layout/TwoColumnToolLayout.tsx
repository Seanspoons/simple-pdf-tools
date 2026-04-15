import { ReactNode } from 'react';

type TwoColumnToolLayoutProps = {
  main: ReactNode;
  side: ReactNode;
  className?: string;
  mainClassName?: string;
  sideClassName?: string;
};

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function TwoColumnToolLayout({
  main,
  side,
  className,
  mainClassName,
  sideClassName
}: TwoColumnToolLayoutProps) {
  return (
    <section className={joinClassNames('tool-two-col-layout', className)}>
      <div className={joinClassNames('tool-main-col', mainClassName)}>{main}</div>
      <div className={joinClassNames('tool-side-col', sideClassName)}>{side}</div>
    </section>
  );
}
