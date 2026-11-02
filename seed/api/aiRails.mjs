// THE RAILS (ring 2026-11-03): how the AI organ's ask reaches each provider — the same SDKs the origin's
// functions use, each `complete(ask)` taking `{apiKey, model, system, messages, json, image}` and
// answering `{text, image?}`. The key is the organ's choice (a kept credential or the node's own) and
// lives in the client object for one call. Imported by main.mjs alone; tests hand the organ stand-ins.
import Anthropic from '@anthropic-ai/sdk';
import {GoogleGenerativeAI} from '@google/generative-ai';
import {AI_MAX_TOKENS,AI_RATE_LIMIT_RETRIES,aiRetryDelayMs,jsonSystemOf,anthropicTurnsOf,geminiContentsOf,providerStatusOf} from '../generated/chain.mjs';

/** @param {{sleep?: (ms: number) => Promise<void>, random?: () => number}} options */
export function createAiRails({sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),random=Math.random}={}) {
  return {
    anthropic:{
      async complete({apiKey,model,system,messages,json}) {
        const turns=anthropicTurnsOf(messages);
        if(!turns.length)return {text:''};
        const client=new Anthropic({apiKey});
        const result=await client.messages.create({model,max_tokens:AI_MAX_TOKENS,system:jsonSystemOf(system,json===true),messages:turns});
        // A refusal is an honest empty answer (the shell speaks its own quiet line); the text blocks are the reply.
        if(result.stop_reason==='refusal')return {text:''};
        return {text:(result.content??[]).filter(block=>block.type==='text').map(block=>block.text).join('')};
      },
    },
    google:{
      async complete({apiKey,model,system,messages,json,image}) {
        const contents=geminiContentsOf(messages);
        if(!contents.length)return {text:''};
        const generationConfig={...(json===true?{responseMimeType:'application/json'}:{}),...(image===true?{responseModalities:['IMAGE','TEXT']}:{})};
        const generative=new GoogleGenerativeAI(apiKey).getGenerativeModel({model,...(system?{systemInstruction:system}:{}),generationConfig});
        for(let attempt=0;;attempt++) {
          try {
            const response=(await generative.generateContent({contents})).response;
            // An image part first: calling text() on a response with non-text parts throws in this SDK.
            const parts=response.candidates?.[0]?.content?.parts??[];
            for(const part of parts) {
              if(part.inlineData?.data) {
                let caption='';
                try {caption=response.text();} catch {/* image-only response */}
                return {image:`data:${part.inlineData.mimeType||'image/png'};base64,${part.inlineData.data}`,text:caption};
              }
            }
            let text='';
            try {text=response.text();} catch {text='';}
            return {text};
          } catch(error) {
            const status=providerStatusOf(error);
            if(status===429 && attempt<AI_RATE_LIMIT_RETRIES) {await sleep(aiRetryDelayMs(attempt)+random()*1000);continue;}
            throw Object.assign(error instanceof Error?error:new Error(String(error)),{status});
          }
        }
      },
    },
  };
}
