import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs';
const [,, inp, outPrefix] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const root = doc.getRoot();
const mats = root.listMaterials();
console.log('materials', mats.length, 'meshes', root.listMeshes().length);
const m = mats[0];
const slots = { base: m.getBaseColorTexture(), normal: m.getNormalTexture(), rm: m.getMetallicRoughnessTexture() };
for (const [k, t] of Object.entries(slots)) {
  if (!t) { console.log('no', k); continue; }
  const ext = t.getMimeType().split('/')[1];
  fs.writeFileSync(`${outPrefix}-${k}.${ext}`, t.getImage());
  console.log(k, t.getMimeType(), t.getSize(), t.getImage().length);
}
console.log('factors', m.getBaseColorFactor(), m.getMetallicFactor(), m.getRoughnessFactor());
m.setBaseColorTexture(null); m.setNormalTexture(null); m.setMetallicRoughnessTexture(null);
for (const t of root.listTextures()) t.dispose();
for (const e of root.listExtensionsUsed()) if (e.extensionName === 'EXT_texture_webp') e.dispose();
const glb = await io.writeBinary(doc);
fs.writeFileSync(`${outPrefix}-mesh.json`, JSON.stringify({ format: 'glb-base64', glb: Buffer.from(glb).toString('base64') }));
console.log('mesh glb bytes', glb.length, 'exts', root.listExtensionsUsed().map(e=>e.extensionName));
