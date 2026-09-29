import {parentPort} from 'node:worker_threads';
import ELK from 'elkjs/lib/elk.bundled.js';
parentPort?.on('message', async (graph) => {
 try { parentPort?.postMessage({ok:true,value:await new (ELK as any)().layout(graph)}); }
 catch (error) { parentPort?.postMessage({ok:false,error:String(error)}); }
});
