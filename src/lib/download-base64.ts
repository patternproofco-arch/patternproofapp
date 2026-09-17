/**
 * Turn an authorized server response into a file download. The bytes come from
 * a one-off authorized response — no public URL is created.
 */
export function downloadBase64(payload: {
  filename: string;
  content_type: string;
  base64: string;
}) {
  const bin = atob(payload.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: payload.content_type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = payload.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
