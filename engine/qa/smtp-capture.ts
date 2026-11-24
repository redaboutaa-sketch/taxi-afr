/**
 * Serveur SMTP de CAPTURE pour la recette locale. N'achemine rien vers un
 * tiers : chaque message accepté est écrit en `.eml` dans un répertoire.
 *
 * - AUTH PLAIN ou LOGIN obligatoire (identifiants attendus en paramètre) :
 *   on teste un transport authentifié, pas un relais ouvert.
 * - `failMode: 'data'` répond 451 au DATA pour simuler une erreur de transport.
 * - Pas de TLS : réservé à la boucle locale de recette. Le transport de
 *   production exige `starttls` ou `tls` (contrat du brief).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer, type Server, type Socket } from 'node:net';
import { join } from 'node:path';

export interface CaptureOptions {
  port: number;
  host?: string;
  dir: string;
  username: string;
  password: string;
  failMode?: 'none' | 'data';
}

export interface CaptureServer {
  server: Server;
  close(): Promise<void>;
  setFailMode(mode: 'none' | 'data'): void;
}

export async function startCapture(opts: CaptureOptions): Promise<CaptureServer> {
  mkdirSync(opts.dir, { recursive: true });
  let failMode = opts.failMode ?? 'none';
  let counter = 0;
  const server = createServer((socket: Socket) => {
    socket.setEncoding('utf8');
    let authed = false;
    let state: 'cmd' | 'data' | 'auth-user' | 'auth-pass' = 'cmd';
    let loginUser = '';
    let from = '';
    let rcpt: string[] = [];
    let data = '';
    let buffer = '';
    const reply = (s: string) => socket.write(`${s}\r\n`);
    reply('220 capture.test ESMTP capture locale (aucun envoi externe)');
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      let idx: number;
      while ((idx = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (state === 'data') {
          if (line === '.') {
            state = 'cmd';
            if (failMode === 'data') {
              reply('451 4.3.0 panne simulée par la capture');
            } else {
              counter += 1;
              const name = `${Date.now()}-${process.pid}-${counter}.eml`;
              writeFileSync(join(opts.dir, name), `X-Capture-Envelope-From: ${from}\r\nX-Capture-Envelope-To: ${rcpt.join(', ')}\r\n${data}`);
              reply(`250 2.0.0 accepté par la capture (${name})`);
            }
            data = '';
          } else {
            data += `${line.startsWith('..') ? line.slice(1) : line}\r\n`;
          }
          continue;
        }
        if (state === 'auth-user') {
          loginUser = Buffer.from(line, 'base64').toString('utf8');
          state = 'auth-pass';
          reply('334 UGFzc3dvcmQ6');
          continue;
        }
        if (state === 'auth-pass') {
          state = 'cmd';
          authed = loginUser === opts.username && Buffer.from(line, 'base64').toString('utf8') === opts.password;
          reply(authed ? '235 2.7.0 authentifié' : '535 5.7.8 identifiants refusés');
          continue;
        }
        const [verb = '', ...rest] = line.split(' ');
        const arg = rest.join(' ');
        switch (verb.toUpperCase()) {
          case 'EHLO':
            reply('250-capture.test');
            reply('250-AUTH PLAIN LOGIN');
            reply('250 8BITMIME');
            break;
          case 'HELO':
            reply('250 capture.test');
            break;
          case 'AUTH': {
            const [mech = '', initial] = arg.split(' ');
            if (mech.toUpperCase() === 'PLAIN' && initial) {
              const [, u, p] = Buffer.from(initial, 'base64').toString('utf8').split('\u0000');
              authed = u === opts.username && p === opts.password;
              reply(authed ? '235 2.7.0 authentifié' : '535 5.7.8 identifiants refusés');
            } else if (mech.toUpperCase() === 'LOGIN') {
              state = 'auth-user';
              reply('334 VXNlcm5hbWU6');
            } else reply('504 5.5.4 mécanisme non pris en charge');
            break;
          }
          case 'MAIL':
            if (!authed) reply('530 5.7.0 authentification requise');
            else {
              from = arg.replace(/^FROM:/i, '').trim();
              rcpt = [];
              reply('250 2.1.0 ok');
            }
            break;
          case 'RCPT':
            if (!authed) reply('530 5.7.0 authentification requise');
            else {
              rcpt.push(arg.replace(/^TO:/i, '').trim());
              reply('250 2.1.5 ok');
            }
            break;
          case 'DATA':
            if (!authed || rcpt.length === 0) reply('503 5.5.1 séquence invalide');
            else {
              state = 'data';
              reply('354 fin par <CRLF>.<CRLF>');
            }
            break;
          case 'RSET':
            from = '';
            rcpt = [];
            reply('250 ok');
            break;
          case 'NOOP':
            reply('250 ok');
            break;
          case 'QUIT':
            reply('221 au revoir');
            socket.end();
            break;
          default:
            reply('502 5.5.2 commande non prise en charge');
        }
      }
    });
    socket.on('error', () => socket.destroy());
  });
  await new Promise<void>((ok) => server.listen(opts.port, opts.host ?? '127.0.0.1', ok));
  return {
    server,
    setFailMode: (m) => (failMode = m),
    close: () => new Promise<void>((ok) => server.close(() => ok())),
  };
}
