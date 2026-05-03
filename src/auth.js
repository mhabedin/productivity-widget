const { google } = require('googleapis');
const { shell } = require('electron');
const http = require('http');
const { URL } = require('url');
const path = require('path');
const fs = require('fs');

const REDIRECT_PORT = 52741;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];
const CREDENTIALS_PATH = path.join(__dirname, '..', 'config', 'credentials.json');

class GCalAuth {
  constructor(userDataPath) {
    this.tokenPath = path.join(userDataPath, 'gcal-tokens.json');
    this.client = null;
    this._init();
  }

  _loadCredentials() {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error(
        `Google credentials not found. Copy config/credentials.example.json to config/credentials.json and fill in your OAuth2 client ID and secret.`
      );
    }
    const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const creds = raw.installed || raw.web;
    return { clientId: creds.client_id, clientSecret: creds.client_secret };
  }

  _init() {
    try {
      const { clientId, clientSecret } = this._loadCredentials();
      this.client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
      if (fs.existsSync(this.tokenPath)) {
        const tokens = JSON.parse(fs.readFileSync(this.tokenPath, 'utf-8'));
        this.client.setCredentials(tokens);
        this.client.on('tokens', (t) => {
          if (t.refresh_token) this._saveTokens(t);
        });
      }
    } catch (e) {
      console.warn('GCalAuth: init skipped –', e.message);
    }
  }

  isAuthenticated() {
    if (!this.client) return false;
    const c = this.client.credentials;
    return !!(c && (c.access_token || c.refresh_token));
  }

  getClient() {
    return this.client;
  }

  authenticate() {
    return new Promise((resolve, reject) => {
      let clientId, clientSecret;
      try {
        ({ clientId, clientSecret } = this._loadCredentials());
      } catch (e) {
        return reject(e);
      }

      this.client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

      const authUrl = this.client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
      });

      const server = http.createServer(async (req, res) => {
        if (!req.url.startsWith('/oauth2callback')) return;
        const params = new URL(req.url, `http://localhost:${REDIRECT_PORT}`).searchParams;
        const code = params.get('code');
        const error = params.get('error');

        if (error) {
          res.end(`<h1>Auth failed: ${error}</h1>`);
          server.close();
          return reject(new Error(error));
        }

        try {
          const { tokens } = await this.client.getToken(code);
          this.client.setCredentials(tokens);
          this._saveTokens(tokens);
          res.end('<h1>Authentication successful!</h1><p>You can close this tab.</p>');
          server.close();
          resolve(true);
        } catch (e) {
          res.end(`<h1>Error: ${e.message}</h1>`);
          server.close();
          reject(e);
        }
      });

      server.listen(REDIRECT_PORT, () => shell.openExternal(authUrl));
      server.on('error', reject);
    });
  }

  revoke() {
    if (this.client) this.client.setCredentials({});
    if (fs.existsSync(this.tokenPath)) fs.unlinkSync(this.tokenPath);
  }

  _saveTokens(tokens) {
    fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2), 'utf-8');
  }
}

module.exports = { GCalAuth };
