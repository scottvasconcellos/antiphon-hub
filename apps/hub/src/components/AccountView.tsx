import { Button, Card, Input } from '@antiphon/ui';

interface AccountViewProps {
  token?: string;
  onTokenChange: (value: string) => void;
  onSave: () => void;
}

export const AccountView = ({ token, onTokenChange, onSave }: AccountViewProps) => (
  <Card className="hub-account" elevated>
    <h2>Account (Optional)</h2>
    <p>Sign in is optional. Account token enables re-download history and upgrade eligibility.</p>
    <Input
      label="Bearer token"
      value={token ?? ''}
      onChange={(event) => onTokenChange(event.target.value)}
      placeholder="Paste OAuth token"
    />
    <Button variant="primary" onClick={onSave}>
      Save token
    </Button>
  </Card>
);
