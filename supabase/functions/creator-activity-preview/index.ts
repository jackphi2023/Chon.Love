import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Chon.Love Web V1 retired the MyFan/Luxy Creator Activity product surface.
// Keep the function slug as a tombstone so old clients fail closed without
// retaining service-role media processing code.
Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: "creator_activity_retired",
      message: "Creator Activity is not part of Chon.Love Web V1.",
    }),
    {
      status: 410,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  ),
);
