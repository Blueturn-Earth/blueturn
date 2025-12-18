export let googleProfile = null;
export let accessToken = null;


export function initGoogleAuth() {
    window.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: "509580731574-fk6ovov57h0b2tq083jv4860qa8ofhqg.apps.googleusercontent.com",
        scope: "openid profile https://www.googleapis.com/auth/drive.file"
    });
}


export function requestGoogleAuth() {
    return new Promise((resolve) => {
      if (accessToken) {
        console.log("Already have Drive access token");
        return resolve();
      }
      console.log("Requesting Drive access token");
      window.tokenClient.callback = async (resp) => {
        if (resp.error) {
          console.error("Error obtaining Drive access token: ", resp);
          reject();
        } else {
          accessToken = resp.access_token;
          console.log("Obtained Drive access token: ", accessToken);
          resolve();
        }
      };
      window.tokenClient.requestAccessToken(/*{ prompt: "consent" }*/);
    });
}
