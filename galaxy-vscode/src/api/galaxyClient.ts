/**
 * galaxyClient.ts
 *
 * Direct port of galaxy_cli.py run/poll logic.
 * Uses the same workflow run → poll → delta extract flow.
 */

import * as vscode from 'vscode';
import { URL } from 'url';

// ============================================================
// Config helpers
// ============================================================

export interface GalaxyConfig {
  apiKey:       string;
  baseUrl:      string;
  workflowId:   string;
  nodeId:       string;
  maxTurns:     number;
  pollInterval: number;
}

export function getConfig(): GalaxyConfig {
  const cfg = vscode.workspace.getConfiguration('galaxy');
  const apiKey = cfg.get<string>('apiKey') || process.env.GALAXY_AI_API_KEY || '';
  if (!apiKey) {
    throw new Error('Galaxy AI: API key not set. Add it in Settings → galaxy.apiKey');
  }
  return {
    apiKey,
    baseUrl:      cfg.get<string>('baseUrl')      || 'https://api.galaxy.ai/api/v1',
    workflowId:   cfg.get<string>('workflowId')   || '',
    nodeId:       cfg.get<string>('nodeId')        || '',
    maxTurns:     cfg.get<number>('maxTurns')      || 6,
    pollInterval: cfg.get<number>('pollInterval')  || 1200,
  };
}

// ============================================================
// HTTP helpers (no external deps, uses Node built-ins)
// ============================================================

async function request(
  method: 'GET' | 'POST',
  url: string,
  headers: Record<string, string>,
  body?: unknown
): Promise<any> {
  const options: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  const res = await fetch(url, options);
  const text = await res.text();
  
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ============================================================
// Output extractor — mirrors extract_output() in CLI
// ============================================================

function extractOutput(data: Record<string, unknown>): string {
  const outputs: string[] = [];
  const nodeRuns = (data.nodeRuns || []) as Record<string, unknown>[];

  for (const node of nodeRuns) {
    const out = node.output;
    if (!out) { continue; }

    if (typeof out === 'object' && out !== null) {
      const obj = out as Record<string, unknown>;
      let found = false;
      for (const k of ['output', 'text', 'content', 'response', 'result']) {
        if (typeof obj[k] === 'string' && obj[k]) {
          outputs.push(obj[k] as string);
          found = true;
          break;
        }
      }
      if (!found) {
        const meta = new Set(['model', 'usage', 'cost_usd', 'creditUsed', 'provider_used', 'status', 'id']);
        for (const k of Object.keys(obj)) {
          if (!meta.has(k) && typeof obj[k] === 'string' && (obj[k] as string).trim()) {
            outputs.push(obj[k] as string);
            break;
          }
        }
      }
    } else if (typeof out === 'string' && out.trim()) {
      outputs.push(out);
    }
  }

  return outputs.join('\n').trim();
}

// ============================================================
// Core run + poll — mirrors run_polling() in CLI
// onDelta fires whenever new text arrives (for live UI updates)
// ============================================================

export async function runWorkflow(
  prompt: string,
  onDelta?: (delta: string) => void,
  cancelToken?: vscode.CancellationToken
): Promise<string> {

  const cfg = getConfig();

  const headers = {
    'Authorization': `Bearer ${cfg.apiKey}`,
    'Content-Type':  'application/json',
  };

  // Start run — same payload structure as CLI
  const payload = {
    workflowId: cfg.workflowId,
    values: {
      [cfg.nodeId]: {
        text_field: prompt,
      },
    },
  };

  const startRes = await request('POST', `${cfg.baseUrl}/runs`, headers, payload) as Record<string, unknown>;
  const runId = startRes.runId as string | undefined;
  if (!runId) {
    throw new Error(`Galaxy AI: run start failed — ${JSON.stringify(startRes)}`);
  }

  const pollUrl  = `${cfg.baseUrl}/runs/${runId}?inDetails=true`;
  let lastOutput = '';
  let fullOutput = '';

  // Poll loop — mirrors while True: in CLI
  while (true) {
    if (cancelToken?.isCancellationRequested) {
      throw new Error('Cancelled');
    }

    await sleep(cfg.pollInterval);

    const poll = await request('GET', pollUrl, headers) as Record<string, unknown>;
    const status  = poll.status as string;
    const current = extractOutput(poll);

    // Fire delta callback for live streaming feel in UI
    if (current && current !== lastOutput) {
      const delta = current.slice(lastOutput.length);
      if (delta && onDelta) { onDelta(delta); }
      lastOutput = current;
      fullOutput = current;
    }

    if (status === 'COMPLETED') { return fullOutput; }

    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(`Galaxy AI: run ${status} — ${poll.error || 'no detail'}`);
    }
  }
}

// ============================================================
// Prompt builder — mirrors build_prompt() in CLI
// ============================================================

export function buildPrompt(
  memory: ConversationTurn[],
  userInput: string,
  maxTurns: number
): string {
  const turns = [...memory, { role: 'user' as const, content: userInput }];
  const trimmed = turns.slice(-(maxTurns * 2));

  let prompt = '';
  for (const msg of trimmed) {
    const label = msg.role === 'user' ? 'USER' : 'ASSISTANT';
    prompt += `${label}:\n${msg.content}\n\n`;
  }
  return prompt.trim();
}

// ============================================================
// Memory management — file-less (stored in extension state)
// ============================================================

export interface ConversationTurn {
  role:    'user' | 'assistant';
  content: string;
}

export function trimMemory(memory: ConversationTurn[], maxTurns: number): ConversationTurn[] {
  return memory.slice(-(maxTurns * 2));
}

// ============================================================
// Utility
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
