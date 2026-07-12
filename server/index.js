import { config } from './config.js';
import { createApp, refresh } from './app.js';

const app = createApp({ serveStatic: true });

await refresh('startup');

setInterval(() => {
  refresh('poll').catch((err) => console.error('[sheets] poll failed', err));
}, config.pollIntervalMs);

app.listen(config.port, () => {
  console.log(`Dashboard Car Park TMT → http://localhost:${config.port}`);
  console.log(`Google Sheet ID: ${config.spreadsheetId}`);
  console.log(`Sheet: ${config.sheetName} | poll every ${config.pollIntervalMs}ms`);
});
