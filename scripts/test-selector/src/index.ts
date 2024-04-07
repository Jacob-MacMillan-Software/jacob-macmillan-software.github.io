/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler deploy src/index.ts --name my-worker` to deploy your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
  SITE_BUCKET: R2Bucket;
}

async function selectExperiment(fingerprint: Array<string | null>, activeExperiments: Array<string>) {
  const fingerprintHash = await hash('SHA-1', JSON.stringify(fingerprint));
  const fingerprintHashString = fingerprintHash.join('');

  const experimentIndex = parseInt(fingerprintHashString, 16) % activeExperiments.length;
  return activeExperiments[experimentIndex];
}

async function hash(algorithm: string, data: string) {
  const msgUint8 = new TextEncoder().encode(data); // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest(algorithm, msgUint8); // hash the message
  const hashArray = new Uint8Array(hashBuffer); // convert buffer to byte array
  return hashArray;
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
    const path = new URL(request.url).pathname;
    const fingerprint: Array<string | null> = [ request.headers.get('cf-connecting-ip'), request.cf?.postalCode as string];

    // Get all top level directories in the bucket. These are all the possible test sites
    const allFiles = await env.SITE_BUCKET.list();

    // Filter to only the top level directories
    const activeExperiments: Array<string> = [];

    for (const file of allFiles.objects) {
      const parts = file.key.split('/');
      if (parts.length === 2 && !activeExperiments.includes(parts[0])) {
        activeExperiments.push(parts[0]);
      }
    }

    // console.log(`Active Experiments: ${JSON.stringify(activeExperiments)}`);

    // Select an experiment based on the fingerprint
    const experiment = await selectExperiment(fingerprint, activeExperiments);

    // console.log(`Selected Experiment: ${experiment}`);

    // Get the file to serve
    // If the path doesn't end with .html or a different file extension, we'll assume it's a directory
    // We'll also be serving images and other assets from the experiment directory, so can't just check for the .html extension
    // We'll serve the index.html file in that directory relative to the root of the selected experiment
    let fileKey = path;
    if (fileKey.split('.')[1] == null) {
      fileKey = `${experiment}${fileKey}index.html`;
    } else {
      fileKey = `${experiment}${fileKey}`;
    }
    
    let file = await env.SITE_BUCKET.get(fileKey);
    let statusCode = 200;

    // If that file doesn't exist, try to serve just ${path with last '/' removed}.html
    if (file == null) {
      if (path.endsWith('/')) {
        file = await env.SITE_BUCKET.get(`${experiment}${path.slice(0, -1)}.html`);
      } else {
        file = await env.SITE_BUCKET.get(`${experiment}${path}.html`);
      }
    }

    // Check if the file exists, if not return the 404.html file from the experiment directory
    if (file == null) {
      file = await env.SITE_BUCKET.get(`${experiment}/404.html`);
      statusCode = 404;
    }

    // If it still doesn't exist, return a generic 404 message
    if (file == null) {
      return new Response('404 Not Found', { status: 404 });
    }

    // console.log(`Serving file: ${fileKey}`);

    // Serve the file
    return new Response(file.body, {
      status: statusCode,
    });

	},
};
