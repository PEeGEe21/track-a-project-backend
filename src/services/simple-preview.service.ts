import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class SimplePreviewService {
  async generatePreview(url: string): Promise<{
    title: string;
    description: string;
    image: string;
    favicon: string;
    domain: string;
  }> {
    try {
      const domain = new URL(url).hostname;

      // For now, return basic preview data without web scraping
      // This avoids the undici/File compatibility issues
      return {
        title: this.extractTitleFromUrl(url),
        description: `Resource from ${domain}`,
        image: this.generateDefaultImage(domain),
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        domain,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate preview for ${url}: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Extract title from URL path
      const segments = pathname
        .split('/')
        .filter((segment) => segment.length > 0);
      const lastSegment = segments[segments.length - 1];

      if (lastSegment) {
        // Convert kebab-case or snake_case to Title Case
        return lastSegment
          .split(/[-_]/)
          .map(
            (word) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(' ');
      }

      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Resource';
    }
  }

  private generateDefaultImage(domain: string): string {
    // Generate a placeholder image using a service like placeholder.com
    const colors = ['4f46e5', '059669', 'dc2626', 'ea580c', '7c3aed', 'db2777'];
    const color = colors[domain.length % colors.length];

    return `https://via.placeholder.com/400x200/${color}/ffffff?text=${encodeURIComponent(
      domain,
    )}`;
  }
}
