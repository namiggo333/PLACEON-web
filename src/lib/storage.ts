import { supabase } from "./supabase";

export const SPACE_IMAGE_BUCKET = "space-images";

/** 장당 업로드 허용 용량 (원본 기준) */
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
/** 공간당 사진 수 */
export const MAX_PHOTOS = 6;

const COMPRESS_MAX_SIZE = 1600;
const COMPRESS_QUALITY = 0.86;
const FALLBACK_MAX_SIZE = 1280;
const FALLBACK_QUALITY = 0.78;

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("사진을 읽지 못했어요. 다른 사진으로 다시 시도해 주세요."));
    };
    image.src = objectUrl;
  });
}

function drawToCanvas(image: HTMLImageElement, maxSize: number): HTMLCanvasElement {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이 브라우저에서는 사진을 처리하지 못했어요.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function compressToBlob(file: File): Promise<Blob> {
  const image = await loadImageElement(file);
  const canvas = drawToCanvas(image, COMPRESS_MAX_SIZE);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), "image/jpeg", COMPRESS_QUALITY)
  );
  if (!blob) throw new Error("사진을 압축하지 못했어요.");
  return blob;
}

async function compressToDataUrl(file: File): Promise<string> {
  const image = await loadImageElement(file);
  const canvas = drawToCanvas(image, FALLBACK_MAX_SIZE);
  return canvas.toDataURL("image/jpeg", FALLBACK_QUALITY);
}

export function validatePhoto(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return `${file.name} 파일은 사진이 아니에요. JPG·PNG·WebP 사진을 골라 주세요.`;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `${file.name} 파일이 너무 커요. 12MB 이하 사진을 골라 주세요.`;
  }
  return null;
}

/** 선택한 사진을 Storage(또는 미리보기 모드의 브라우저 저장소)에 올리고 접근 가능한 URL 목록을 돌려준다. */
export async function uploadSpacePhotos(files: File[], hostId: string): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    if (supabase) {
      const blob = await compressToBlob(file);
      const path = `${hostId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from(SPACE_IMAGE_BUCKET).upload(path, blob, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) {
        throw new Error(
          `사진을 올리지 못했어요. (${error.message}) 잠시 후 다시 시도해 주세요.`
        );
      }
      const { data } = supabase.storage.from(SPACE_IMAGE_BUCKET).getPublicUrl(path);
      urls.push(data.publicUrl);
    } else {
      urls.push(await compressToDataUrl(file));
    }
  }

  return urls;
}

function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${SPACE_IMAGE_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const path = url.slice(index + marker.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

/** 공간에서 빠진 사진 파일을 Storage에서 정리한다(미리보기 모드의 DataURL은 그냥 건너뛴다). */
export async function deleteSpacePhotos(urls: string[]): Promise<void> {
  if (!supabase || urls.length === 0) return;
  const paths = urls.map(storagePathFromUrl).filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(SPACE_IMAGE_BUCKET).remove(paths);
  } catch (error) {
    console.warn("사진 파일 정리에 실패했어요.", error);
  }
}
