import React, { useEffect } from "react";

export interface SEOProps {
  title: string;
  description?: string;
  canonicalPath?: string;
  noindex?: boolean;
}

export const SEO: React.FC<SEOProps> = ({
  title,
  description = "Official Traffic Rules and Fines Assistant grounded in the Motor Vehicles Act 2019 and Central Motor Vehicles Rules.",
  canonicalPath = "",
  noindex = false,
}) => {
  useEffect(() => {
    // 1. Page title
    const fullTitle = `${title} | Parivahan AI Legal Assistant`;
    document.title = fullTitle;

    // Helper to update or create meta tags
    const setMetaTag = (nameAttr: string, key: string, content: string) => {
      let element = document.querySelector(`meta[${nameAttr}="${key}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(nameAttr, key);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    // 2. Meta description
    setMetaTag("name", "description", description);

    // 3. Robots meta (noindex for admin, index for public)
    const robotsContent = noindex ? "noindex, nofollow" : "index, follow";
    setMetaTag("name", "robots", robotsContent);

    // 4. Open Graph & Twitter
    setMetaTag("property", "og:title", fullTitle);
    setMetaTag("property", "og:description", description);
    setMetaTag("name", "twitter:title", fullTitle);
    setMetaTag("name", "twitter:description", description);

    const canonicalUrl = `https://parivahan-ai.gov.in${canonicalPath}`;
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", canonicalUrl);
    setMetaTag("property", "og:url", canonicalUrl);
  }, [title, description, canonicalPath, noindex]);

  return null;
};
