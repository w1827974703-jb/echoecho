// lib/oss.ts — 服务端：阿里云 OSS 音频中转
//
// 安全红线：本文件只在服务端（API Route）import，读取 OSS_* 凭证。
// 绝不能被客户端组件引用，凭证绝不出现在发往浏览器的响应里。
//
// 用途：把上传的音频临时存到 OSS，生成一个有时效的「签名 URL」，
// 交给 Paraformer 去拉取（私有 bucket + 签名 URL，不公开桶）。

import OSS from "ali-oss";

function getClient(): OSS {
  const region = process.env.OSS_REGION;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  const bucket = process.env.OSS_BUCKET;

  if (!region || !accessKeyId || !accessKeySecret || !bucket) {
    throw new Error(
      "缺少 OSS 环境变量（OSS_REGION / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET）",
    );
  }

  return new OSS({
    region, // 如 oss-cn-beijing（不带 .aliyuncs.com）
    accessKeyId,
    accessKeySecret,
    bucket,
    secure: true, // 用 https
  });
}

export interface UploadedAudio {
  /** OSS 对象 key（用于后续删除等） */
  objectKey: string;
  /** 有时效的签名 URL（供 Paraformer 拉取） */
  signedUrl: string;
}

/**
 * 上传音频 buffer 到 OSS，返回签名 URL。
 * @param buffer 音频二进制
 * @param filename 原始文件名（用于推断扩展名）
 * @param expiresSec 签名 URL 有效期（秒），默认 1 小时
 */
export async function uploadAudio(
  buffer: Buffer,
  filename: string,
  expiresSec = 3600,
): Promise<UploadedAudio> {
  const client = getClient();

  // 对象 key：audios/时间戳-随机.扩展名（避免中文/特殊字符问题，只保留扩展名）
  const extMatch = filename.toLowerCase().match(/\.(mp3|m4a|wav|aac|flac|ogg)$/);
  const ext = extMatch ? extMatch[0] : "";
  const objectKey = `audios/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

  await client.put(objectKey, buffer);

  // 生成签名 URL（私有 bucket 下 Paraformer 才能临时访问）
  const signedUrl = client.signatureUrl(objectKey, { expires: expiresSec });

  return { objectKey, signedUrl };
}

/** 删除 OSS 上的音频对象（转录完成后可清理，MVP 可选）。 */
export async function deleteAudio(objectKey: string): Promise<void> {
  const client = getClient();
  await client.delete(objectKey);
}
