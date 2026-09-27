// Ping - a small reader for Mapbox Vector Tiles, the .pbf map tiles that
// OpenFreeMap serves (see realMap.js). It reads just what the landing map
// needs: the layers asked for, and each feature's type, properties and
// geometry. Format: https://github.com/mapbox/vector-tile-spec (version 2).

const utf8 = new TextDecoder();

// Protocol Buffers: varints, zigzag and length-delimited fields.
class Pbf {
  constructor(bytes, pos = 0, end = bytes.length) {
    this.b = bytes;
    this.pos = pos;
    this.end = end;
  }

  // Plain arithmetic rather than bit operators, so values over 2^31 survive.
  varint() {
    let result = 0;
    let mul = 1;
    let byte;
    do {
      byte = this.b[this.pos++];
      result += (byte & 0x7f) * mul;
      mul *= 128;
    } while (byte & 0x80);
    return result;
  }

  svarint() {
    const n = this.varint();
    return n % 2 ? (n + 1) / -2 : n / 2;
  }

  string() {
    const len = this.varint();
    const s = utf8.decode(this.b.subarray(this.pos, this.pos + len));
    this.pos += len;
    return s;
  }

  skip(wire) {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) this.pos += this.varint();
    else if (wire === 5) this.pos += 4;
    else throw new Error(`Unsupported protobuf wire type ${wire}`);
  }
}

// Commands: 1 = MoveTo, 2 = LineTo (each with zigzag x/y deltas), 7 = ClosePath.
// Returns the parts as flat [x0, y0, x1, y1, ...] arrays in tile units.
function decodeGeometry(bytes, start, end) {
  const p = new Pbf(bytes, start, end);
  const parts = [];
  let x = 0;
  let y = 0;
  let cmd = 0;
  let count = 0;
  let part = null;
  while (p.pos < end) {
    if (count === 0) {
      const c = p.varint();
      cmd = c & 7;
      count = Math.floor(c / 8);
      if (count === 0) continue;
    }
    count--;
    if (cmd === 1 || cmd === 2) {
      x += p.svarint();
      y += p.svarint();
      if (cmd === 1) parts.push((part = [x, y]));
      else if (part) part.push(x, y);
    } else if (cmd === 7) {
      if (part && part.length >= 2) part.push(part[0], part[1]);
    } else {
      break;
    }
  }
  return parts;
}

function readValue(bytes, start, end) {
  const p = new Pbf(bytes, start, end);
  let v = null;
  while (p.pos < end) {
    const tag = p.varint();
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    if (field === 1 && wire === 2) v = p.string();
    else if (field === 2 && wire === 5) { v = new DataView(bytes.buffer, bytes.byteOffset + p.pos, 4).getFloat32(0, true); p.pos += 4; }
    else if (field === 3 && wire === 1) { v = new DataView(bytes.buffer, bytes.byteOffset + p.pos, 8).getFloat64(0, true); p.pos += 8; }
    else if ((field === 4 || field === 5) && wire === 0) v = p.varint();
    else if (field === 6 && wire === 0) v = p.svarint();
    else if (field === 7 && wire === 0) v = !!p.varint();
    else p.skip(wire);
  }
  return v;
}

function readFeature(bytes, start, end, keys, values, layer, keep) {
  const p = new Pbf(bytes, start, end);
  let type = 0;
  let geom = null;
  const props = {};
  while (p.pos < end) {
    const tag = p.varint();
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    if (field === 2 && wire === 2) {
      const tagsEnd = p.varint() + p.pos;
      while (p.pos < tagsEnd) {
        const k = keys[p.varint()];
        const v = values[p.varint()];
        if (k !== undefined) props[k] = v;
      }
    } else if (field === 3 && wire === 0) {
      type = p.varint();
    } else if (field === 4 && wire === 2) {
      const len = p.varint();
      geom = [p.pos, p.pos + len];
      p.pos += len;
    } else {
      p.skip(wire);
    }
  }
  // Only decode the geometry of features the caller will draw.
  if (!geom || (keep && !keep(layer, props, type))) return null;
  return { type, props, geom: decodeGeometry(bytes, geom[0], geom[1]) };
}

function readLayer(bytes, start, end, wanted, keep) {
  const p = new Pbf(bytes, start, end);
  let name = '';
  let extent = 4096;
  const keys = [];
  const values = [];
  const spans = [];
  while (p.pos < end) {
    const tag = p.varint();
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    if (field === 1 && wire === 2) {
      name = p.string();
      if (wanted && !wanted.has(name)) return null;
    } else if (field === 2 && wire === 2) {
      const len = p.varint();
      spans.push(p.pos, p.pos + len);
      p.pos += len;
    } else if (field === 3 && wire === 2) {
      keys.push(p.string());
    } else if (field === 4 && wire === 2) {
      const len = p.varint();
      values.push(readValue(bytes, p.pos, p.pos + len));
      p.pos += len;
    } else if (field === 5 && wire === 0) {
      extent = p.varint();
    } else {
      p.skip(wire);
    }
  }
  if (wanted && !wanted.has(name)) return null;
  const features = [];
  for (let i = 0; i < spans.length; i += 2) {
    const f = readFeature(bytes, spans[i], spans[i + 1], keys, values, name, keep);
    if (f) features.push(f);
  }
  return { name, extent, features };
}

// { layerName: { extent, features: [{ type, props, geom }] } } for the layers
// in `wanted` (a Set; all when null). `keep(layer, props, type)` filters
// features before their geometry is decoded. Feature types: 1 point, 2 line,
// 3 polygon.
export function readTile(buffer, wanted = null, keep = null) {
  const bytes = new Uint8Array(buffer);
  const p = new Pbf(bytes);
  const layers = {};
  while (p.pos < p.end) {
    const tag = p.varint();
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    if (field === 3 && wire === 2) {
      const len = p.varint();
      const layer = readLayer(bytes, p.pos, p.pos + len, wanted, keep);
      if (layer) layers[layer.name] = layer;
      p.pos += len;
    } else {
      p.skip(wire);
    }
  }
  return layers;
}
