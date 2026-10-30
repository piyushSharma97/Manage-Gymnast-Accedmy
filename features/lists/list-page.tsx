import { Fragment, ReactNode } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Container } from '@/components/common/container';
import { DesktopOnly } from '@/components/mobile-pattern';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
  ToolbarTitle,
} from '@/components/common/toolbar';

export type ListCrumb = {
  label: string;
  href?: string;
};

/**
 * Shared toolbar and breadcrumb used by student, attendance, and fee lists.
 * Each role route still supplies its own list component.
 */
export function ListPage({
  title,
  crumbs,
  children,
  desktopToolbarOnly = false,
}: {
  title: string;
  crumbs: ListCrumb[];
  children: ReactNode;
  desktopToolbarOnly?: boolean;
}) {
  const toolbar = (
    <Container>
      <Toolbar>
        <ToolbarHeading>
          <ToolbarTitle>{title}</ToolbarTitle>
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1;
                return (
                  <Fragment key={`${crumb.label}-${index}`}>
                    {index > 0 ? <BreadcrumbSeparator /> : null}
                    <BreadcrumbItem>
                      {isLast || !crumb.href ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </ToolbarHeading>
        <ToolbarActions />
      </Toolbar>
    </Container>
  );

  return (
    <>
      {desktopToolbarOnly ? <DesktopOnly>{toolbar}</DesktopOnly> : toolbar}
      <Container>{children}</Container>
    </>
  );
}
