// Ping Web Platform - profile photo preparation. A picked photo is cropped to
// a centred square and shrunk to a JPEG before upload, so a 5 MB phone photo
// becomes a ~60 KB avatar (and fits the 2 MB bucket limit in extras.sql).

export async function toAvatarJpeg(file, size = 512) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Pick an image file (JPG, PNG or WebP).');
  if (file.size > 15 * 1024 * 1024) throw new Error('That photo is too big. Pick one under 15 MB.');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (e) {
    throw new Error("Couldn't read that photo. Try a JPG or PNG.");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(size, side);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  if (bitmap.close) bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that photo."))), 'image/jpeg', 0.86);
  });
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
