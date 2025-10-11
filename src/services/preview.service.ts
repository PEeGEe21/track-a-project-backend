import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as cheerio from 'cheerio';

@Injectable()
export class PreviewService {
  async generatePreview(url: string): Promise<{
    title: string;
    description: string;
    image: string;
    favicon: string;
    domain: string;
  }> {
    try {
      // Use Node.js built-in fetch (Node 18+) or provide fallback
      const response = await this.fetchWithFallback(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const domain = new URL(url).hostname;

      // Extract metadata
      const title = this.extractTitle($, url);
      const description = this.extractDescription($);
      const image = this.extractImage($, url);
      const favicon = this.extractFavicon($, url);

      return {
        title,
        description,
        image,
        favicon,
        domain,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate preview for ${url}: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async fetchWithFallback(url: string): Promise<Response> {
    // Try Node.js built-in fetch first (Node 18+)
    if (typeof globalThis.fetch === 'function') {
      return await globalThis.fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        signal: AbortSignal.timeout(10000),
      });
    }

    // Fallback to node-fetch if available
    try {
      const { default: fetch } = await import('node-fetch');
      return await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 10000,
      } as any);
    } catch (importError) {
      throw new Error(
        'No fetch implementation available. Please install node-fetch or use Node.js 18+',
      );
    }
  }

  private extractTitle($: cheerio.CheerioAPI, url: string): string {
    // Try multiple meta tags for title
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      new URL(url).pathname.split('/').pop() ||
      url;

    return title.trim().substring(0, 200); // Limit length
  }

  private extractDescription($: cheerio.CheerioAPI): string {
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('p').first().text();

    return description?.trim().substring(0, 300) || ''; // Limit length
  }

  private extractImage($: cheerio.CheerioAPI, url: string): string {
    const baseUrl = new URL(url).origin;

    // Try multiple image sources
    const imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[name="twitter:image:src"]').attr('content') ||
      $('img[class*="hero"], img[class*="banner"], img[class*="featured"]')
        .first()
        .attr('src') ||
      $('img').first().attr('src');

    if (!imageUrl) return '';

    // Convert relative URLs to absolute
    if (imageUrl.startsWith('//')) {
      return `https:${imageUrl}`;
    } else if (imageUrl.startsWith('/')) {
      return `${baseUrl}${imageUrl}`;
    } else if (imageUrl.startsWith('http')) {
      return imageUrl;
    } else {
      return `${baseUrl}/${imageUrl}`;
    }
  }

  private extractFavicon($: cheerio.CheerioAPI, url: string): string {
    const baseUrl = new URL(url).origin;

    const faviconUrl =
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      $('link[rel="apple-touch-icon"]').attr('href') ||
      '/favicon.ico';

    if (faviconUrl.startsWith('//')) {
      return `https:${faviconUrl}`;
    } else if (faviconUrl.startsWith('/')) {
      return `${baseUrl}${faviconUrl}`;
    } else if (faviconUrl.startsWith('http')) {
      return faviconUrl;
    } else {
      return `${baseUrl}${faviconUrl}`;
    }
  }

  async generateThumbnail(imageUrl: string): Promise<string> {
    try {
      // For now, return the original image URL
      // In production, you might want to:
      // 1. Download the image
      // 2. Resize it to a standard thumbnail size (e.g., 300x200)
      // 3. Upload to Firebase Storage
      // 4. Return the thumbnail URL

      return imageUrl;
    } catch (error) {
      throw new HttpException(
        `Failed to generate thumbnail: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
