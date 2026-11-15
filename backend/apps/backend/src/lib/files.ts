/**
 * Where files uploaded through AQUENORA live (see the file module in medusa-config.ts):
 * an S3/R2 bucket when S3_FILE_URL is set, otherwise the backend's own /static folder.
 */
export function fileUrlBases(): string[] {
  const backend = (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/+$/, "")
  const bases = [`${backend}/static/`]
  if (process.env.S3_FILE_URL) bases.push(`${process.env.S3_FILE_URL.replace(/\/+$/, "")}/`)
  return bases
}

/** True for a picture uploaded through POST /sellers/me/uploads (not some other website's image). */
export function isOwnFileUrl(url: string): boolean {
  return fileUrlBases().some((base) => url.startsWith(base))
}
