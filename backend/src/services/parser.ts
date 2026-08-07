import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { createCanvas } from 'canvas';
import { createExtractorFromData } from 'node-unrar-js';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
import { IMAGE_EXTENSIONS } from '../config.js';
import { sortNaturally } from '../utils/naturalSort.js';

export type FileFormat = 'cbz' | 'cbr' | 'pdf' | 'folder';

export interface ExtractedPage {
  buffer: Buffer;
  mimeType: string;
}

export function getFormat(filePath: string): FileFormat | null {
  if (fs.statSync(filePath).isDirectory()) return 'folder';
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.cbz' || ext === '.zip') return 'cbz';
  if (ext === '.cbr' || ext === '.rar') return 'cbr';
  if (ext === '.pdf') return 'pdf';
  return null;
}

function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

function getImageMimeType(name: string): string {
  switch (path.extname(name).toLowerCase()) {
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    case '.bmp': return 'image/bmp';
    default: return 'application/octet-stream';
  }
}

function listImagesInFolder(dir: string): string[] {
  const entries = fs.readdirSync(dir)
    .filter((name) => isImageFile(name))
    .map((name) => path.join(dir, name));
  return sortNaturally(entries, (p) => path.basename(p));
}

async function listImagesInCbz(filePath: string): Promise<string[]> {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries()
    .filter((e) => !e.isDirectory && isImageFile(e.entryName))
    .map((e) => e.entryName);
  return sortNaturally(entries, (n) => path.basename(n));
}

async function listImagesInCbr(filePath: string): Promise<string[]> {
  const buffer = fs.readFileSync(filePath);
  const extractor = await createExtractorFromData({ data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) });
  const fileNames: string[] = [];
  const extracted = extractor.extract();
  for (const file of extracted.files) {
    if (file.fileHeader.flags.directory) continue;
    const name = file.fileHeader.name;
    if (isImageFile(name)) fileNames.push(name);
  }
  return sortNaturally(fileNames, (n) => path.basename(n));
}

async function getPdfPageCount(filePath: string): Promise<number> {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  return doc.numPages;
}

export async function getPageCount(filePath: string, format: FileFormat): Promise<number> {
  switch (format) {
    case 'folder':
      return listImagesInFolder(filePath).length;
    case 'cbz':
      return (await listImagesInCbz(filePath)).length;
    case 'cbr':
      return (await listImagesInCbr(filePath)).length;
    case 'pdf':
      return getPdfPageCount(filePath);
    default:
      return 0;
  }
}

async function extractCbzPage(filePath: string, pageIndex: number): Promise<ExtractedPage> {
  const names = await listImagesInCbz(filePath);
  const entryName = names[pageIndex];
  if (!entryName) throw new Error('Page not found');
  const zip = new AdmZip(filePath);
  const entry = zip.getEntry(entryName);
  if (!entry) throw new Error('Page not found');
  return { buffer: entry.getData(), mimeType: getImageMimeType(entryName) };
}

async function extractCbrPage(filePath: string, pageIndex: number): Promise<ExtractedPage> {
  const names = await listImagesInCbr(filePath);
  const target = names[pageIndex];
  if (!target) throw new Error('Page not found');

  const buffer = fs.readFileSync(filePath);
  const extractor = await createExtractorFromData({ data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) });
  const extracted = extractor.extract({ files: [target] });
  for (const file of extracted.files) {
    if (file.fileHeader.name === target && file.extraction) {
      return { buffer: Buffer.from(file.extraction), mimeType: getImageMimeType(target) };
    }
  }
  throw new Error('Page not found');
}

async function extractFolderPage(filePath: string, pageIndex: number): Promise<ExtractedPage> {
  const images = listImagesInFolder(filePath);
  const imagePath = images[pageIndex];
  if (!imagePath) throw new Error('Page not found');
  return { buffer: fs.readFileSync(imagePath), mimeType: getImageMimeType(imagePath) };
}

async function extractPdfPage(filePath: string, pageIndex: number): Promise<ExtractedPage> {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
  const context = canvas.getContext('2d');

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;

  return { buffer: canvas.toBuffer('image/jpeg', { quality: 0.9 }), mimeType: 'image/jpeg' };
}

export async function extractPage(filePath: string, format: FileFormat, pageIndex: number): Promise<ExtractedPage> {
  switch (format) {
    case 'cbz':
      return extractCbzPage(filePath, pageIndex);
    case 'cbr':
      return extractCbrPage(filePath, pageIndex);
    case 'folder':
      return extractFolderPage(filePath, pageIndex);
    case 'pdf':
      return extractPdfPage(filePath, pageIndex);
    default:
      throw new Error('Unsupported format');
  }
}

export async function extractCover(filePath: string, format: FileFormat): Promise<Buffer | null> {
  try {
    const count = await getPageCount(filePath, format);
    if (count === 0) return null;
    const page = await extractPage(filePath, format, 0);
    return sharp(page.buffer).resize(300, 450, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
  } catch {
    return null;
  }
}
