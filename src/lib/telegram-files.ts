import axios from 'axios';
import { utapi } from '@/lib/uploadthing-server';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

export async function downloadTelegramFile(fileId: string): Promise<{ buffer: Buffer; fileName: string }> {
  const fileRes = await axios.get(`${TELEGRAM_API}/getFile`, {
    params: { file_id: fileId },
  });

  const filePath = fileRes.data?.result?.file_path as string | undefined;
  if (!filePath) {
    throw new Error('Could not resolve Telegram file path');
  }

  const fileName = filePath.split('/').pop() ?? 'resume.pdf';
  const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;

  const download = await axios.get<ArrayBuffer>(fileUrl, { responseType: 'arraybuffer' });
  return { buffer: Buffer.from(download.data), fileName };
}

export async function uploadResumeBuffer(buffer: Buffer, fileName: string): Promise<string> {
  const safeName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const file = new File([new Uint8Array(buffer)], safeName, { type: 'application/pdf' });
  const result = await utapi.uploadFiles([file]);

  if (result[0]?.error) {
    throw new Error(result[0].error.message);
  }

  return result[0]!.data!.url;
}
