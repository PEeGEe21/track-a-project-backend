import { createHmac, randomUUID } from 'crypto';

function argument(name: string, required = true) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (required && !value) throw new Error(`Missing --${name}`);
  return value;
}

async function main() {
  const url = argument('url') as string;
  const secret = argument('secret') as string;
  const repository = argument('repository') as string;
  const taskId = Number(argument('task-id'));
  const repositoryId = Number(argument('repository-id', false) || 987654321);
  const dryRun = process.argv.includes('--dry-run');
  if (!Number.isInteger(taskId) || taskId < 1)
    throw new Error('--task-id must be a positive integer');
  if (!/^https:\/\//.test(url) && !/^http:\/\/localhost(?::\d+)?\//.test(url))
    throw new Error('--url must use HTTPS (or localhost HTTP)');

  const now = new Date().toISOString();
  const base = {
    repository: {
      id: repositoryId,
      full_name: repository,
      html_url: `https://github.com/${repository}`,
    },
    sender: { login: 'tailpoint-pilot' },
  };
  const marker = Date.now();
  const deliveries = [
    {
      event: 'issues',
      body: {
        ...base,
        action: 'opened',
        issue: {
          id: marker + 1,
          number: 601,
          title: `Phase 6A pilot TP-${taskId}`,
          body: 'Synthetic signed pilot event',
          state: 'open',
          html_url: `https://github.com/${repository}/issues/601`,
          updated_at: now,
        },
      },
    },
    {
      event: 'pull_request',
      body: {
        ...base,
        action: 'opened',
        pull_request: {
          id: marker + 2,
          number: 602,
          title: `Ship TP-${taskId}`,
          body: 'Synthetic signed pilot event',
          state: 'open',
          merged: false,
          html_url: `https://github.com/${repository}/pull/602`,
          updated_at: now,
          head: { ref: `tp-${taskId}` },
        },
      },
    },
    {
      event: 'push',
      body: {
        ...base,
        commits: [
          {
            id: `${marker.toString(16).padStart(40, '0')}`.slice(-40),
            message: `Synthetic push for TP-${taskId}`,
            timestamp: now,
            url: `https://github.com/${repository}/commit/${marker.toString(
              16,
            )}`,
            author: { username: 'tailpoint-pilot' },
          },
        ],
      },
    },
    {
      event: 'deployment_status',
      body: {
        ...base,
        action: 'created',
        deployment: {
          id: marker + 3,
          environment: 'phase-6a-pilot',
          description: `Deploy TP-${taskId}`,
          ref: `tp-${taskId}`,
        },
        deployment_status: {
          state: 'success',
          target_url: `https://github.com/${repository}/deployments`,
          updated_at: now,
        },
      },
    },
    {
      event: 'release',
      body: {
        ...base,
        action: 'published',
        release: {
          id: marker + 4,
          tag_name: `pilot-${marker}`,
          name: `Phase 6A TP-${taskId}`,
          body: 'Synthetic signed pilot event',
          html_url: `https://github.com/${repository}/releases/tag/pilot-${marker}`,
          published_at: now,
          updated_at: now,
        },
      },
    },
  ];

  for (const delivery of deliveries) {
    const raw = JSON.stringify(delivery.body);
    const id = randomUUID();
    const signature = `sha256=${createHmac('sha256', secret)
      .update(raw)
      .digest('hex')}`;
    if (dryRun) {
      process.stdout.write(`${delivery.event} ${id} (dry run)\n`);
      continue;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-delivery': id,
        'x-github-event': delivery.event,
        'x-hub-signature-256': signature,
      },
      body: raw,
    });
    const responseBody = await response.text();
    process.stdout.write(
      `${delivery.event}: ${response.status} ${responseBody}\n`,
    );
    if (!response.ok)
      throw new Error(`${delivery.event} pilot delivery was rejected`);
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
});
