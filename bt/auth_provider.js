export class AuthProvider {
    authCb = null;
    wasAuthCbCalled = false;

    setAuthCb(cb)
    {
        this.authCb = cb;
        this.wasAuthCbCalled = false;
    }

    async ensureAuth() {
        try {
            const accessToken = await this.ensureAuthImpl()
            const profile = this.getProfile();
            if (this.authCb && profile && !this.wasAuthCbCalled) {
                this.authCb(profile);
                this.wasAuthCbCalled = true;
            }
            return accessToken;
        }
        catch(error) {
            console.error("Failed to authenticate: " + error);
            return null;
        };
    }

    ensureAuthImpl() {
        throw new Error("unimplemented method");
    }

    getProfile() {
        console.error("Not implemented");
        return {
            given_name: undefined, // first name
            name: undefined, // full name (first + family)
            sub: undefined, // the id
            picture: undefined // picture image URL
        };
    }
}
