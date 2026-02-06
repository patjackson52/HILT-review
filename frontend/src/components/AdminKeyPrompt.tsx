import { useState } from 'react';
import { Card, CardHeader, CardContent, Button, Input } from './ui';
import styles from './AdminKeyPrompt.module.css';

interface AdminKeyPromptProps {
  onSave: (key: string) => void;
}

export function AdminKeyPrompt({ onSave }: AdminKeyPromptProps) {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      onSave(key.trim());
    }
  };

  return (
    <Card className={styles.card}>
      <CardHeader>
        <h2 className={styles.title}>Admin API Key Required</h2>
      </CardHeader>
      <CardContent>
        <p className={styles.description}>
          To manage integrations and API keys, you need an admin API key.
          Enter your admin key below to continue.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputWrapper}>
            <Input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="hilt_live_..."
              fullWidth
              autoComplete="off"
            />
            <button
              type="button"
              className={styles.toggleButton}
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <Button type="submit" disabled={!key.trim()}>
            Save Admin Key
          </Button>
        </form>
        <p className={styles.hint}>
          Don't have an admin key? Generate one using the CLI:{' '}
          <code>npx tsx scripts/create-api-key.ts --admin</code>
        </p>
      </CardContent>
    </Card>
  );
}
