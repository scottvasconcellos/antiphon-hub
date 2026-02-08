import { Button, Card, Progress } from '@antiphon/ui';
import type { DownloadJob } from '@/state/hub-store';

interface DownloadManagerDrawerProps {
  jobs: DownloadJob[];
}

export const DownloadManagerDrawer = ({ jobs }: DownloadManagerDrawerProps) => (
  <Card className="hub-download-manager">
    <header>
      <h3>Download manager</h3>
      <p>Queue persists across restarts.</p>
    </header>
    {jobs.length === 0 ? <p>No active downloads.</p> : null}
    <ul>
      {jobs.map((job) => {
        const percent = Math.round((job.downloadedBytes / Math.max(job.totalBytes, 1)) * 100);
        return (
          <li key={job.id} className="hub-download-manager__item">
            <div>
              <strong>{job.productId}</strong>
              <span>
                {job.state} • {percent}% • {Math.round(job.speedBps / 1024)}KB/s
              </span>
            </div>
            <Progress value={percent} />
            <div className="hub-download-manager__controls">
              <Button variant="ghost" disabled>
                Pause
              </Button>
              <Button variant="ghost" disabled>
                Resume
              </Button>
              <Button variant="ghost" disabled>
                Cancel
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  </Card>
);
