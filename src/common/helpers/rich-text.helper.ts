import * as cheerio from 'cheerio';

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'a',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

const BLOCK_TAGS = new Set([
  'p',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapPlainTextAsHtml(value: string): string {
  const escaped = escapeHtml(value.trim());
  if (!escaped) {
    return '';
  }

  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function isSafeHref(href: string): boolean {
  const normalizedHref = href.trim().toLowerCase();

  return (
    normalizedHref.startsWith('http://') ||
    normalizedHref.startsWith('https://') ||
    normalizedHref.startsWith('mailto:') ||
    normalizedHref.startsWith('tel:') ||
    normalizedHref.startsWith('/') ||
    normalizedHref.startsWith('#')
  );
}

function normalizePlainText($: cheerio.CheerioAPI): string {
  $('br').replaceWith('\n');

  for (const tag of BLOCK_TAGS) {
    $(tag).each((_, element) => {
      const current = $(element);
      current.before('\n');
      current.after('\n');
    });
  }

  return $('body')
    .text()
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function normalizeRichTextDescription(input: {
  description?: unknown;
  description_html?: unknown;
}): {
  description: string;
  description_html: string | null;
} | null {
  const rawPlain =
    input.description === undefined || input.description === null
      ? undefined
      : String(input.description);
  const rawHtml =
    input.description_html === undefined || input.description_html === null
      ? undefined
      : String(input.description_html);

  if (rawPlain === undefined && rawHtml === undefined) {
    return null;
  }

  const sourceHtml =
    rawHtml !== undefined ? rawHtml : wrapPlainTextAsHtml(rawPlain ?? '');
  const $ = cheerio.load(`<body>${sourceHtml}</body>`);

  $('script, style, iframe, object, embed, form, input, button, textarea, select').remove();

  $('*').each((_, element) => {
    const current = $(element);
    const elementNode = element as any;
    const tagName = elementNode.tagName?.toLowerCase();

    if (!tagName || tagName === 'html' || tagName === 'body') {
      return;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      current.replaceWith(current.contents());
      return;
    }

    const attributes = { ...(elementNode.attribs ?? {}) };
    Object.keys(attributes).forEach((attribute) => {
      if (tagName === 'a' && ['href', 'target', 'rel'].includes(attribute)) {
        return;
      }

      current.removeAttr(attribute);
    });

    if (tagName === 'a') {
      const href = current.attr('href');
      if (!href || !isSafeHref(href)) {
        current.removeAttr('href');
      }

      const target = current.attr('target');
      if (target === '_blank') {
        current.attr('rel', 'noopener noreferrer');
      } else {
        current.removeAttr('target');
        current.removeAttr('rel');
      }
    }
  });

  const description = normalizePlainText($);
  const descriptionHtml = $('body').html()?.trim() ?? '';

  return {
    description,
    description_html: descriptionHtml || null,
  };
}
