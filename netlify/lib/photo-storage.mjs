import { getStore } from "@netlify/blobs";
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const photoPath = (id) => `catalog/${id}`;
let cachedClient;
let cachedAccount;

function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  const values = [accountId, accessKeyId, secretAccessKey, bucket, publicUrl];
  if (values.every((value) => !value)) return null;
  if (values.some((value) => !value)) throw new Error("Configura juntas R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET y R2_PUBLIC_URL.");
  if (!/^https:\/\//.test(publicUrl)) throw new Error("R2_PUBLIC_URL debe comenzar por https://.");
  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
}

function r2Client(settings) {
  if (!cachedClient || cachedAccount !== settings.accountId) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
    });
    cachedAccount = settings.accountId;
  }
  return cachedClient;
}

export function publicPhotoUrl(id) {
  const settings = r2Config();
  return settings ? `${settings.publicUrl}/${photoPath(id)}` : `/.netlify/functions/photo?id=${id}`;
}

export function r2PhotoId(url) {
  const settings = r2Config();
  if (!settings || typeof url !== "string") return null;
  const prefix = `${settings.publicUrl}/catalog/`;
  const id = url.startsWith(prefix) ? url.slice(prefix.length) : "";
  return /^[a-f0-9-]{36}$/.test(id) ? id : null;
}

export async function savePhoto(id, data, contentType) {
  const settings = r2Config();
  if (!settings) {
    await getStore({ name: "catalog-501-photos", consistency: "strong" }).set(id, data, { metadata: { contentType } });
  } else {
    await r2Client(settings).send(new PutObjectCommand({
      Bucket: settings.bucket,
      Key: photoPath(id),
      Body: Buffer.from(data),
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }));
  }
  return publicPhotoUrl(id);
}

export async function photoExists(id, fromR2 = Boolean(r2Config())) {
  if (!fromR2) return Boolean(await getStore({ name: "catalog-501-photos", consistency: "strong" }).getWithMetadata(id));
  const settings = r2Config();
  if (!settings) throw new Error("Cloudflare R2 no está configurado.");
  try {
    await r2Client(settings).send(new HeadObjectCommand({ Bucket: settings.bucket, Key: photoPath(id) }));
    return true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound" || error?.name === "NoSuchKey") return false;
    throw error;
  }
}

export async function deletePhoto(id, fromR2) {
  if (!fromR2) {
    await getStore({ name: "catalog-501-photos", consistency: "strong" }).delete(id);
    return;
  }
  const settings = r2Config();
  if (!settings) throw new Error("Cloudflare R2 no está configurado.");
  await r2Client(settings).send(new DeleteObjectCommand({ Bucket: settings.bucket, Key: photoPath(id) }));
}
