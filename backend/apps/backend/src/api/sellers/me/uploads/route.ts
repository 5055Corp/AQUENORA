import crypto from "node:crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import type { UploadImageBody } from "../../validators"

const EXT: Record<UploadImageBody["mime_type"], string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" }

/** The file really is the image type it claims (checks the first bytes). */
function looksLike(buf: Buffer, mime: UploadImageBody["mime_type"]): boolean {
  switch (mime) {
    case "image/png":
      return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    case "image/jpeg":
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    case "image/webp":
      return buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP"
  }
}

/**
 * POST /sellers/me/uploads { kind: "logo" | "banner", mime_type, data (base64) }
 * Stores a store image and returns its public address. The seller then saves it in their design.
 */
export async function POST(req: AuthenticatedMedusaRequest<UploadImageBody>, res: MedusaResponse) {
  const { kind, mime_type, data } = req.validatedBody
  const buf = Buffer.from(data, "base64")
  if (buf.length > 2 * 1024 * 1024) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "That picture is too big. Use one under 2 MB.")
  }
  if (!looksLike(buf, mime_type)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "That file isn't a picture we can use. Try a JPG, PNG or WebP photo.")
  }
  // A new name each time, so browsers and caches never show the old picture.
  const name = `${req.auth_context.actor_id}-${kind}-${crypto.randomBytes(4).toString("hex")}.${EXT[mime_type]}`
  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: { files: [{ filename: name, mimeType: mime_type, content: data, access: "public" }] },
  })
  const [file] = result
  res.json({ url: file.url })
}
