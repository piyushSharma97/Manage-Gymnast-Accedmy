'use client';

import { generalSettings } from '@/config/general.config';
import { Container } from '@/components/common/container';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <Container>
        <div className="flex flex-col md:flex-row justify-center md:justify-between items-center gap-3 py-5">
          <div className="flex order-2 md:order-1  gap-2 font-normal text-sm">
            <span className="text-muted-foreground">{currentYear} &copy;</span>
            <a
              href="https://example.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary-foreground hover:text-primary"
            >
              My Academy Inc.
            </a>
          </div>
          <nav className="flex order-1 md:order-2 gap-4 font-normal text-sm text-muted-foreground">
            
            <a
              href={generalSettings.faqLink}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary"
            >
              FAQ
            </a>
            <a
              href="https://example.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary"
            >
              Support
            </a>
           
          </nav>
        </div>
      </Container>
    </footer>
  );
}
