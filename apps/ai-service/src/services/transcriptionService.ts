import { promises as fs } from 'node:fs';
import { extname } from 'node:path';
import { config } from '../config.js';
import { createDashScopeClient } from './openaiClient.js';

function mimeFromPath(path: string) {
  const ext = extname(path).toLowerCase();
  if (ext === '.m4a') return 'audio/mp4';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.caf') return 'audio/x-caf';
  return 'audio/mpeg';
}

export async function transcribeFile(filePath: string) {
  const client = createDashScopeClient();
  const buffer = await fs.readFile(filePath);
  if (buffer.length < 128) {
    return { transcript: '', durationSec: 0 };
  }

  const dataUri = `data:${mimeFromPath(filePath)};base64,${buffer.toString('base64')}`;
  const completion = await client.chat.completions.create({
    model: config.transcribeModel,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: dataUri,
            },
          },
        ],
      },
    ],
    stream: false,
    extra_body: {
      asr_options: {
        language: 'zh',
        enable_itn: false,
      },
    },
  } as never);

  const transcript = completion.choices[0]?.message?.content?.trim() ?? '';
  const usage = completion.usage as { seconds?: number } | undefined;
  return {
    transcript,
    durationSec: usage?.seconds ?? 0,
  };
}
