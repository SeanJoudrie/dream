import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { mergeState } from '../public/core.js';

// The cloud mirror. There are no accounts in the prototype: each device holds a
// random sync key, and another device joins by entering the same key. The server
// stores one JSON blob per key, filed under a hash of the key so the key itself
// never touches disk.

const KEY_RE = /^[a-z0-9]{24,64}$/;

export function createSyncStore(dir) {
  const file = (key) => {
    if (!KEY_RE.test(key || '')) {
      const err = new Error('bad sync key');
      err.status = 400;
      throw err;
    }
    return join(dir, createHash('sha256').update(key).digest('hex') + '.json');
  };

  return {
    async get(key) {
      try {
        return JSON.parse(await readFile(file(key), 'utf8'));
      } catch (e) {
        if (e.code === 'ENOENT') return { entries: [], dead: [] };
        throw e;
      }
    },
    // Merges rather than overwrites, so two devices pushing at once can't
    // clobber each other. Returns the merged copy for the caller to adopt.
    async put(key, data) {
      const path = file(key);
      const merged = mergeState(await this.get(key), data);
      await mkdir(dir, { recursive: true });
      const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tmp, JSON.stringify(merged));
      await rename(tmp, path);
      return merged;
    },
    async erase(key) {
      await rm(file(key), { force: true });
    },
  };
}
