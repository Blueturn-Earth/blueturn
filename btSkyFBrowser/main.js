import React from "https://esm.sh/react@18";
import ReactDOM from "https://esm.sh/react-dom@18/client";


import { initFirebase, signInAnon } from "./firebase.js";
import { initGoogleAuth } from "./auth_google.js";
import { Gallery } from "./gallery.js";


function App() {
    const [ready, setReady] = React.useState(false);


    React.useEffect(() => {
            async function init() {
            await initFirebase();
            await signInAnon();
            initGoogleAuth();
            setReady(true);
        }
        init();
    }, []);


    React.useEffect(() => {
        setTimeout(() => setReady(true), 500);
    }, []);

    if (!ready) {
        return React.createElement(
            "div",
            { className: "loading" },
            "Loading…"
        );
    }

    return React.createElement(Gallery);
}


const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
