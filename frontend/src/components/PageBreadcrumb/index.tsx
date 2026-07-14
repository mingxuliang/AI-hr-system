import React from 'react';
import { resolveRouteMeta } from '../../config/routeMeta';

type PageBreadcrumbProps = {
  pathname: string;
  extra?: React.ReactNode;
};

const PageBreadcrumb: React.FC<PageBreadcrumbProps> = ({ pathname, extra }) => {
  const meta = resolveRouteMeta(pathname);

  return (
    <div className="page-breadcrumb-bar">
      <nav className="page-breadcrumb" aria-label="面包屑">
        {meta.group ? (
          <>
            <span className="page-breadcrumb-group">{meta.group}</span>
            <span className="page-breadcrumb-sep">/</span>
            <span className="page-breadcrumb-current">{meta.label}</span>
          </>
        ) : (
          <span className="page-breadcrumb-current">{meta.label}</span>
        )}
      </nav>
      {extra ? <div className="page-breadcrumb-extra">{extra}</div> : null}
    </div>
  );
};

export default PageBreadcrumb;
