import { Tabs, TabList, Tab, TabPanel, CodeBlock } from './ui';
import styles from './IntegrationInstructions.module.css';

interface IntegrationInstructionsProps {
  sourceId: string;
  apiKey?: string;
}

export function IntegrationInstructions({ sourceId, apiKey }: IntegrationInstructionsProps) {
  const keyPlaceholder = apiKey || 'YOUR_API_KEY';
  const apiUrl = window.location.origin;

  const curlExample = `curl -X POST ${apiUrl}/api/v1/review-tasks \\
  -H "Authorization: Bearer ${keyPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "source_id": "${sourceId}",
    "title": "Draft email to customer",
    "service": { "id": "email", "name": "Email Service" },
    "action": { "type": "send", "verb": "Send email" },
    "risk_level": "medium",
    "blocks": [
      {
        "id": "content",
        "type": "markdown",
        "content": "# Hello\\n\\nThis is a draft email...",
        "editable": true
      }
    ]
  }'`;

  const mcpConfig = `{
  "mcpServers": {
    "hilt-review": {
      "command": "npx",
      "args": ["@hilt-review/mcp-server"],
      "env": {
        "HILT_API_URL": "${apiUrl}",
        "HILT_API_KEY": "${keyPlaceholder}",
        "HILT_SOURCE_ID": "${sourceId}"
      }
    }
  }
}`;

  const nodeExample = `const response = await fetch('${apiUrl}/api/v1/review-tasks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${keyPlaceholder}',
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(),
  },
  body: JSON.stringify({
    source_id: '${sourceId}',
    title: 'Draft email to customer',
    service: { id: 'email', name: 'Email Service' },
    action: { type: 'send', verb: 'Send email' },
    risk_level: 'medium',
    blocks: [{
      id: 'content',
      type: 'markdown',
      content: '# Hello\\n\\nThis is a draft email...',
      editable: true,
    }],
  }),
});

const task = await response.json();
console.log('Task created:', task.id);

// Poll for decision
let result;
do {
  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch(\`${apiUrl}/api/v1/review-tasks/\${task.id}\`, {
    headers: { 'Authorization': 'Bearer ${keyPlaceholder}' },
  });
  result = await res.json();
} while (result.status === 'PENDING');

console.log('Decision:', result.status);`;

  const pythonExample = `import requests
import uuid

response = requests.post(
    '${apiUrl}/api/v1/review-tasks',
    headers={
        'Authorization': 'Bearer ${keyPlaceholder}',
        'Content-Type': 'application/json',
        'Idempotency-Key': str(uuid.uuid4()),
    },
    json={
        'source_id': '${sourceId}',
        'title': 'Draft email to customer',
        'service': {'id': 'email', 'name': 'Email Service'},
        'action': {'type': 'send', 'verb': 'Send email'},
        'risk_level': 'medium',
        'blocks': [{
            'id': 'content',
            'type': 'markdown',
            'content': '# Hello\\n\\nThis is a draft email...',
            'editable': True,
        }],
    },
)

task = response.json()
print(f"Task created: {task['id']}")

# Poll for decision
import time
while True:
    time.sleep(2)
    result = requests.get(
        f"${apiUrl}/api/v1/review-tasks/{task['id']}",
        headers={'Authorization': 'Bearer ${keyPlaceholder}'},
    ).json()
    if result['status'] != 'PENDING':
        break

print(f"Decision: {result['status']}")`;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Integration Instructions</h3>
      <p className={styles.subtitle}>
        Use these code snippets to integrate your agent with HILT-Review.
        {!apiKey && (
          <span className={styles.warning}>
            {' '}Generate an API key above to see complete examples.
          </span>
        )}
      </p>

      <Tabs defaultTab="curl">
        <TabList>
          <Tab value="curl">cURL</Tab>
          <Tab value="mcp">MCP Config</Tab>
          <Tab value="node">Node.js</Tab>
          <Tab value="python">Python</Tab>
        </TabList>

        <TabPanel value="curl">
          <p className={styles.description}>
            Create a review task using cURL:
          </p>
          <CodeBlock code={curlExample} language="bash" />
        </TabPanel>

        <TabPanel value="mcp">
          <p className={styles.description}>
            Add this to your MCP config file (e.g., <code>claude_desktop_config.json</code>):
          </p>
          <CodeBlock code={mcpConfig} language="json" />
        </TabPanel>

        <TabPanel value="node">
          <p className={styles.description}>
            Create a review task and poll for decision using Node.js:
          </p>
          <CodeBlock code={nodeExample} language="javascript" />
        </TabPanel>

        <TabPanel value="python">
          <p className={styles.description}>
            Create a review task and poll for decision using Python:
          </p>
          <CodeBlock code={pythonExample} language="python" />
        </TabPanel>
      </Tabs>
    </div>
  );
}
