import { Inflate } from '../node_modules/fflate/esm/browser.js';

export async function normalizeHwp3GraphicChars(bytes) {
  const signature = new TextDecoder('ascii').decode(bytes.subarray(0, 24));
  if (!signature.startsWith('HWP Document File V3.00')) throw new Error('HWP 3.0 파일이 아닙니다.');
  const bodyStart = 30 + 128 + 1008 + bytes[30 + 126] + (bytes[30 + 127] << 8);
  if (bodyStart >= bytes.length) throw new Error('HWP 3.0 본문 위치가 올바르지 않습니다.');

  let body = bytes.subarray(bodyStart);
  let trailing = new Uint8Array(0);
  if (bytes[30 + 124]) {
    const chunks = [];
    let size = 0;
    const inflater = new Inflate(chunk => {
      size += chunk.length;
      if (size > 64 * 1024 * 1024) {
        throw new Error('HWP 3.0 압축 해제 본문이 너무 큽니다.');
      }
      chunks.push(chunk);
    });
    inflater.push(body, true);
    if (inflater.s.f !== 1) throw new Error('HWP 3.0 압축 본문이 끝나지 않았습니다.');
    // fflate 0.8.2는 압축 스트림 뒤의 첨부 데이터를 p에 남긴다.
    trailing = inflater.p.subarray((inflater.s.p + 7) >> 3);
    body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  }

  let fixed = false;
  const mapped = body.slice();
  for (let i = 0; i + 1 < mapped.length; i++) {
    if (mapped[i] !== 0x66 || mapped[i + 1] !== 0x30) continue;
    // HWP3 원시 graphic code 0x3066은 웹한글에서 U+2027로 복사된다.
    // rhwp 0.9.0이 이미 U+2027로 해석하는 동의 코드 0x3157로 옮긴다.
    mapped[i] = 0x57;
    mapped[i + 1] = 0x31;
    fixed = true;
    i++;
  }
  if (!fixed) return bytes;
  const result = new Uint8Array(bodyStart + mapped.length + trailing.length);
  result.set(bytes.subarray(0, bodyStart));
  result[30 + 124] = 0;
  result.set(mapped, bodyStart);
  result.set(trailing, bodyStart + mapped.length);
  return result;
}
