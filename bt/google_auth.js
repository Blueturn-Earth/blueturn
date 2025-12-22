import {AuthProvider} from './auth_provider.js';

export class GoogleAuth extends AuthProvider {
  constructor(clientId = '509580731574-fk6ovov57h0b2tq083jv4860qa8ofhqg.apps.googleusercontent.com') {
    super();
    this.clientId = clientId;
    this.accessToken = null;
    this.profile = null;
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: 
        "openid " +
        "profile " +
        "https://www.googleapis.com/auth/drive.file " +
        "https://www.googleapis.com/auth/drive.metadata.readonly"
    });
  }

  async fetchGoogleProfile(accessToken) {
    const res = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    return await res.json();
  }

  ensureAuthImpl() {
    if (this.accessToken && this.profile) {
        console.log("Already have Google access token");
        return this.profile;
    }
    return new Promise((resolve) => {
      console.log("Requesting Google access token");
      this.tokenClient.callback = async (resp) => {
        if (resp.error) {
          console.error("Error obtaining Google access token: ", resp);
          reject(resp.error);
        } else {
          this.accessToken = resp.access_token;
          console.log("Obtained Google access token: ", this.accessToken);
          this.profile = await this.fetchGoogleProfile(this.accessToken);
          console.log("Obtained Google profile: ", this.profile);
          resolve(this.accessToken);
        }
      };
      this.tokenClient.requestAccessToken(/*{ prompt: "consent" }*/);
    });
  }

  getProfile()
  {
    return this.profile;
  }
}

let _authProvider = null;

export function getAuthProvider() {
  if (!_authProvider) {
    _authProvider = new GoogleAuth();
  }
  return _authProvider;
}

