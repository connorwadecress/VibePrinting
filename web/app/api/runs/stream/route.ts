/**
 * GET /api/runs/stream?jobId=...
 *
 * Server-Sent Events endpoint that streams a single job's logs and
 * status updates to the browser. On connect we replay the in-memory
 * logTail (so reload-mid-run still shows the prefix), then attach a
 * subscriber to the job-store event bus and forward live events.
 *
 * The connection closes naturally when the job reaches a terminal
 * status. The client (RunStreamView) is responsible for not
 * reconnecting in that case.
 */

import { requireAuth } from "@/lib/auth";
import { getJob, subscribeJob, type JobRecord } from "@/lib/job-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TERMINAL: ReadonlyArray<JobRecord["status"]> = ["success", "failed", "cancelled"];

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return new Response("missing jobId", { status: 400 });
  }
  const job = getJob(jobId);
  if (!job) {
    return new Response("not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          closed = true;
        }
      };

      // Initial replay: current status + every buffered log line.
      send("status", { job });
      for (const line of job.logTail) send("log", { line });

      // If the job is already terminal, close immediately after replay.
      if (TERMINAL.includes(job.status)) {
        send("end", { status: job.status });
        try { controller.close(); } catch {}
        closed = true;
        return;
      }

      // Live subscription.
      const unsubscribe = subscribeJob(
        jobId,
        (line) => send("log", { line }),
        (updated) => {
          send("status", { job: updated });
          if (TERMINAL.includes(updated.status)) {
            send("end", { status: updated.status });
            unsubscribe();
            try { controller.close(); } catch {}
            closed = true;
          }
        },
      );

      // Heartbeat keeps reverse proxies (and the browser EventSource)
      // from idling out the connection during long stage gaps.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, 15_000);

      // Clean up when the client disconnects.
      const abort = () => {
        clearInterval(heartbeat);
        unsubscribe();
        closed = true;
        try { controller.close(); } catch {}
      };
      request.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
