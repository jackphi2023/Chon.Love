import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import * as ort from 'npm:onnxruntime-web@1.27.0/wasm';

const ORT_VERSION = '1.27.0';
const ORT_DIST = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const YUNET_URL = 'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar_int8bq.onnx';
const SFACE_URL = 'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec_int8.onnx';
const POC_TOKEN = Deno.env.get('PHOTO_V02B_POC_TOKEN');

ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = ORT_DIST;
ort.env.logLevel = 'warning';

type SessionProbe = {
  modelBytes: number;
  fetchMs: number;
  createSessionMs: number;
  inputNames: readonly string[];
  outputNames: readonly string[];
  inputMetadata: unknown;
  outputMetadata: unknown;
};

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

function now(): number {
  return performance.now();
}

function safeMetadata(session: ort.InferenceSession): { inputMetadata: unknown; outputMetadata: unknown } {
  const dynamic = session as unknown as Record<string, unknown>;
  return {
    inputMetadata: dynamic.inputMetadata ?? null,
    outputMetadata: dynamic.outputMetadata ?? null,
  };
}

async function fetchModel(url: string): Promise<{ bytes: Uint8Array; fetchMs: number }> {
  const started = now();
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Chon.Love-PHOTO-V02B/1.0' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`model_fetch_failed:${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 100_000) throw new Error('model_fetch_too_small');
  return { bytes, fetchMs: now() - started };
}

async function probeSession(url: string): Promise<SessionProbe> {
  const fetched = await fetchModel(url);
  const started = now();
  const session = await ort.InferenceSession.create(fetched.bytes, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
  const createSessionMs = now() - started;
  const metadata = safeMetadata(session);
  return {
    modelBytes: fetched.bytes.byteLength,
    fetchMs: Number(fetched.fetchMs.toFixed(3)),
    createSessionMs: Number(createSessionMs.toFixed(3)),
    inputNames: session.inputNames,
    outputNames: session.outputNames,
    ...metadata,
  };
}

function authorized(req: Request): boolean {
  if (!POC_TOKEN) return false;
  return req.headers.get('x-photo-v02b-token') === POC_TOKEN;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: jsonHeaders });
  if (!authorized(req)) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: jsonHeaders });

  const requestStarted = now();
  try {
    const [yunet, sface] = await Promise.all([
      probeSession(YUNET_URL),
      probeSession(SFACE_URL),
    ]);

    return new Response(JSON.stringify({
      poc: 'PHOTO-V02B',
      mode: 'edge_runtime_model_probe',
      runtime: 'supabase_edge_deno',
      ortVersion: ORT_VERSION,
      wasmThreads: ort.env.wasm.numThreads,
      wasmProxy: ort.env.wasm.proxy,
      totalWallMs: Number((now() - requestStarted).toFixed(3)),
      yunet,
      sface,
      productionWrites: false,
      productionUserData: false,
    }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : undefined;
    return new Response(JSON.stringify({
      poc: 'PHOTO-V02B',
      mode: 'edge_runtime_model_probe',
      error: message,
      stack,
      totalWallMs: Number((now() - requestStarted).toFixed(3)),
      productionWrites: false,
      productionUserData: false,
    }), { status: 500, headers: jsonHeaders });
  }
});
