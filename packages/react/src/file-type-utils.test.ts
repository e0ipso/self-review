import { describe, it, expect } from 'vitest';
import {
  getRenderedTextMode,
  isHtmlFile,
  isMarkdownFile,
  isPreviewableImage,
  isPreviewableRenderedText,
  isPreviewableSvg,
} from './utils/file-type-utils';

describe('isPreviewableImage', () => {
  it('returns true for .jpg', () => {
    expect(isPreviewableImage('photo.jpg')).toBe(true);
  });

  it('returns true for .jpeg', () => {
    expect(isPreviewableImage('photo.jpeg')).toBe(true);
  });

  it('returns true for .png', () => {
    expect(isPreviewableImage('image.png')).toBe(true);
  });

  it('returns true for .gif', () => {
    expect(isPreviewableImage('animation.gif')).toBe(true);
  });

  it('returns true for .webp', () => {
    expect(isPreviewableImage('image.webp')).toBe(true);
  });

  it('returns true for .ico', () => {
    expect(isPreviewableImage('favicon.ico')).toBe(true);
  });

  it('returns true for .bmp', () => {
    expect(isPreviewableImage('bitmap.bmp')).toBe(true);
  });

  it('returns true for uppercase extension .PNG', () => {
    expect(isPreviewableImage('image.PNG')).toBe(true);
  });

  it('returns true for uppercase extension .JPG', () => {
    expect(isPreviewableImage('photo.JPG')).toBe(true);
  });

  it('returns false for .svg', () => {
    expect(isPreviewableImage('vector.svg')).toBe(false);
  });

  it('returns false for .ts', () => {
    expect(isPreviewableImage('component.ts')).toBe(false);
  });

  it('returns false for .pdf', () => {
    expect(isPreviewableImage('document.pdf')).toBe(false);
  });

  it('works with paths containing directories', () => {
    expect(isPreviewableImage('assets/images/logo.png')).toBe(true);
  });
});

describe('isPreviewableSvg', () => {
  it('returns true for .svg', () => {
    expect(isPreviewableSvg('icon.svg')).toBe(true);
  });

  it('returns true for uppercase extension .SVG', () => {
    expect(isPreviewableSvg('icon.SVG')).toBe(true);
  });

  it('returns false for .png', () => {
    expect(isPreviewableSvg('image.png')).toBe(false);
  });

  it('returns false for .ts', () => {
    expect(isPreviewableSvg('component.ts')).toBe(false);
  });

  it('works with paths containing directories', () => {
    expect(isPreviewableSvg('assets/icons/logo.svg')).toBe(true);
  });
});

describe('rendered text helpers', () => {
  it('recognizes markdown files as rendered text', () => {
    expect(isMarkdownFile('README.md')).toBe(true);
    expect(isMarkdownFile('docs/guide.markdown')).toBe(true);
    expect(isPreviewableRenderedText('README.MD')).toBe(true);
    expect(getRenderedTextMode('docs/guide.markdown')).toBe('markdown');
  });

  it('recognizes .html and .htm files as rendered text', () => {
    expect(isHtmlFile('page.html')).toBe(true);
    expect(isHtmlFile('templates/index.htm')).toBe(true);
    expect(isPreviewableRenderedText('PAGE.HTML')).toBe(true);
    expect(getRenderedTextMode('templates/index.htm')).toBe('html');
  });

  it('does not classify images, svg, or extensionless files as rendered text', () => {
    expect(getRenderedTextMode('image.png')).toBeNull();
    expect(getRenderedTextMode('icon.svg')).toBeNull();
    expect(getRenderedTextMode('Dockerfile')).toBeNull();
  });
});
