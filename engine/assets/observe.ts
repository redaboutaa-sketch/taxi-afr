/**
 * Observation technique d'un fichier, sans dépendance : empreinte, format
 * (octets magiques), dimensions, canal alpha, PRÉSENCE de métadonnées.
 * Ne vérifie AUCUNE signature : un marqueur C2PA détecté reste un indice,
 * pas une preuve (vérification par un outil dédié = volet `signature`).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Observed } from './contract.ts';

function pngInfo(b: Buffer) {
  const width = b.readUInt32BE(16);
  const height = b.readUInt32BE(20);
  const colorType = b[25];
  let alpha = colorType === 4 || colorType === 6;
  let exif = false;
  let c2pa = false;
  let pos = 8;
  while (pos + 8 <= b.length) {
    const len = b.readUInt32BE(pos);
    const type = b.toString('latin1', pos + 4, pos + 8);
    if (type === 'tRNS') alpha = true;
    if (type === 'eXIf') exif = true;
    if (type === 'caBX') c2pa = true;
    pos += 12 + len;
    if (type === 'IEND') break;
  }
  return { width, height, alpha, exif, c2pa };
}

function jpegInfo(b: Buffer) {
  let pos = 2;
  let width: number | null = null;
  let height: number | null = null;
  let exif = false;
  while (pos + 4 < b.length && b[pos] === 0xff) {
    const marker = b[pos + 1] ?? 0;
    const len = b.readUInt16BE(pos + 2);
    if (marker === 0xe1 && b.toString('latin1', pos + 4, pos + 8) === 'Exif') exif = true;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      height = b.readUInt16BE(pos + 5);
      width = b.readUInt16BE(pos + 7);
      break;
    }
    pos += 2 + len;
  }
  return { width, height, alpha: false, exif, c2pa: false };
}

function svgInfo(s: string) {
  const num = (attr: string) => {
    const m = new RegExp(`<svg[^>]*\\s${attr}="([0-9.]+)(px)?"`).exec(s);
    return m?.[1] ? Math.round(Number(m[1])) : null;
  };
  const vb = /<svg[^>]*\sviewBox="[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)"/.exec(s);
  return { width: num('width') ?? (vb?.[1] ? Math.round(Number(vb[1])) : null), height: num('height') ?? (vb?.[2] ? Math.round(Number(vb[2])) : null) };
}

export function observe(file: string, today: string = new Date().toISOString().slice(0, 10)): Observed {
  const b = readFileSync(file);
  const latin = b.toString('latin1');
  let format: Observed['format'] = 'unknown';
  let width: number | null = null;
  let height: number | null = null;
  let alpha: boolean | null = null;
  let exif = false;
  let c2pa = /jumb[\s\S]{0,64}c2pa|c2pa\.(claim|manifest|signature)/.test(latin);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
    format = 'png';
    const i = pngInfo(b);
    ({ width, height, alpha } = i);
    exif = i.exif;
    c2pa ||= i.c2pa;
  } else if (b[0] === 0xff && b[1] === 0xd8) {
    format = 'jpeg';
    const i = jpegInfo(b);
    ({ width, height, alpha } = i);
    exif = i.exif;
  } else if (latin.startsWith('RIFF') && latin.slice(8, 12) === 'WEBP') {
    format = 'webp';
  } else if (latin.slice(4, 12) === 'ftypavif') {
    format = 'avif';
  } else if (latin.startsWith('GIF8')) {
    format = 'gif';
  } else if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/.test(b.toString('utf8'))) {
    format = 'svg';
    ({ width, height } = svgInfo(b.toString('utf8')));
  }
  const dst = /digitalsourcetype\/([A-Za-z]+)/i.exec(latin)?.[1] ?? null;
  return {
    sha256: createHash('sha256').update(b).digest('hex'),
    bytes: b.length,
    format,
    width,
    height,
    alpha,
    metadata: { exif, xmp: latin.includes('http://ns.adobe.com/xap/1.0/') || latin.includes('<x:xmpmeta'), c2paMarker: c2pa, digitalSourceType: dst },
    scannedOn: today,
  };
}
