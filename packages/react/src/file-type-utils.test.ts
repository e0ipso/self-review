import { describe, it, expect } from 'vitest';
import { isPreviewableImage, isPreviewableSvg } from './utils/file-type-utils';

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
