export let googleProfile = null;
export let googleAccessToken = null;
export const SUPER_USER_ID = "115698886322844446345";

export function initGoogleAuth() {
    window.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: "509580731574-fk6ovov57h0b2tq083jv4860qa8ofhqg.apps.googleusercontent.com",
        scope: "openid profile https://www.googleapis.com/auth/drive.file"
    });
}

async function fetchGoogleProfile() {
  const res = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: {
        Authorization: `Bearer ${googleAccessToken}`
      }
    }
  );
  return await res.json();
}

export function requestGoogleAuth() {
    return new Promise((resolve) => {
      if (googleAccessToken) {
        console.log("Already have Drive access token");
        return resolve();
      }
      console.log("Requesting Drive access token");
      window.tokenClient.callback = async (resp) => {
        if (resp.error) {
          console.error("Error obtaining Drive access token: ", resp);
          reject();
        } else {
          googleAccessToken = resp.access_token;
          console.log("Obtained Drive access token: ", googleAccessToken);
          googleProfile = await fetchGoogleProfile();
          console.log("Obtained Google profile: ", googleProfile);
          resolve();
        }
      };
      window.tokenClient.requestAccessToken(/*{ prompt: "consent" }*/);
    });
}
