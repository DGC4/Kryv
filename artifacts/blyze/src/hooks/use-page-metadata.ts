import { useEffect } from 'react';

type PageMetadata = {
  title: string;
  description: string;
  imageUrl?: string | null;
  type?: 'website' | 'video.other' | 'profile';
};

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  element.href = url;
}

/**
 * Synchronizes client document metadata with records already loaded by a public route.
 * This improves in-browser sharing and navigation context. Static-host social crawlers
 * still receive the document shell until server-rendered route metadata is introduced.
 */
export function usePageMetadata({ title, description, imageUrl, type = 'website' }: PageMetadata) {
  useEffect(() => {
    const fullTitle = `${title} · Kryv`;
    const url = window.location.href;
    document.title = fullTitle;
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:type"]', 'property', 'og:type', type);
    setMeta('meta[property="og:url"]', 'property', 'og:url', url);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    if (imageUrl) {
      setMeta('meta[property="og:image"]', 'property', 'og:image', imageUrl);
      setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', imageUrl);
    }
    setCanonical(url);
  }, [description, imageUrl, title, type]);
}
