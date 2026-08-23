import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import * as ort from 'https://esm.sh/onnxruntime-web@1.17.3?bundle&target=deno';

// PHOTO-V02B is a runtime benchmark only. It never reads Chon.Love user data,
// never writes Supabase data, and must not be wired into signup activation.
const POC_TOKEN = Deno.env.get('PHOTO_V02B_POC_TOKEN');
const YUNET_URL = 'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx';
const SFACE_URL = 'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec_int8.onnx';

ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/';
ort.env.logLevel = 'warning';

let yunetSessionPromise: Promise<ort.InferenceSession> | null = null;
let sfaceSessionPromise: Promise<ort.InferenceSession> | null = null;

async function loadSession(url: string): Promise<ort.InferenceSession> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`model_fetch_failed:${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
}

function getYunetSession(): Promise<ort.InferenceSession> {
  return yunetSessionPromise ??= loadSession(YUNET_URL);
}

function getSfaceSession(): Promise<ort.InferenceSession> {
  return sfaceSessionPromise ??= loadSession(SFACE_URL);
}

// Synthetic tensors deliberately benchmark inference only; no biometric or member
// image is required. The official YuNet FP32 input is fixed at 640x640 and the
// SFace input is 112x112.
const yunetTensor = new ort.Tensor(
  'float32',
  new Float32Array(1 * 3 * 640 * 640).fill(0.25),
  [1, 3, 640, 640],
);
const sfaceTensor = new ort.Tensor(
  'float32',
  new Float32Array(1 * 3 * 112 * 112).fill(0.25),
  [1, 3, 112, 112],
);

function authorized(req: Request): boolean {
  return Boolean(POC_TOKEN) && req.headers.get('x-photo-v02b-token') === POC_TOKEN;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  if (!authorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let copies = 1;
  try {
    const body = await req.json() as { copies?: number };
    copies = Math.min(2, Math.max(1, Math.trunc(Number(body.copies) || 1)));
  } catch {
    // Default to one detector + embedding pair.
  }

  const cold = !yunetSessionPromise || !sfaceSessionPromise;
  const started = performance.now();

  try {
    const [yunet, sface] = await Promise.all([getYunetSession(), getSfaceSession()]);
    const sessionsReady = performance.now();

    for (let index = 0; index < copies; index += 1) {
      await yunet.run({ input: yunetTensor });
      await sface.run({ data: sfaceTensor });
    }

    const finished = performance.now();
    return Response.json({
      poc: 'PHOTO-V02B',
      runtime: 'supabase_edge_deno',
      ortVersion: '1.17.3',
      models: { yunet: '2023mar_fp32', sface: '2021dec_int8' },
      copies,
      cold,
      sessionReadyMs: Number((sessionsReady - started).toFixed(2)),
      inferenceMs: Number((finished - sessionsReady).toFixed(2)),
      totalWallMs: Number((finished - started).toFixed(2)),
      productionWrites: false,
      productionUserData: false,
    });
  } catch (error) {
    return Response.json({
      poc: 'PHOTO-V02B',
      copies,
      cold,
      error: error instanceof Error ? error.message : String(error),
      totalWallMs: Number((performance.now() - started).toFixed(2)),
      productionWrites: false,
      productionUserData: false,
    }, { status: 500 });
  }
});
