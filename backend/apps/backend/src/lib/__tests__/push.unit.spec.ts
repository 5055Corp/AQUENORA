import { generateKeyPairSync, verify } from "node:crypto"
import { providerToken, withPushToken } from "../push"

describe("push notifications", () => {
  it("signs Apple's provider token with the .p8 key (ES256)", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
    process.env.APNS_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString()
    process.env.APNS_KEY_ID = "ABC123DEFG"
    process.env.APNS_TEAM_ID = "TEAM123456"
    const [h, c, s] = providerToken().split(".")
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "ES256", kid: "ABC123DEFG" })
    expect(JSON.parse(Buffer.from(c, "base64url").toString()).iss).toBe("TEAM123456")
    const ok = verify("sha256", Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"))
    expect(ok).toBe(true)
  })

  it("keeps at most 5 phones, newest last, no repeats", () => {
    let list = withPushToken(null, "a")
    for (const t of ["b", "c", "d", "e", "f", "a"]) list = withPushToken(list, t)
    expect(list.map((t) => t.token)).toEqual(["c", "d", "e", "f", "a"])
  })
})
