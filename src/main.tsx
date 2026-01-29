import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Options from "./Options";
import Toast from "./Toast";
import "./index.css";

// Determine which component to render based on URL parameter
const urlParams = new URLSearchParams(window.location.search);
const windowType = urlParams.get("window");

function getRootComponent() {
	switch (windowType) {
		case "toast":
			return Toast;
		case "options":
			return Options;
		default:
			return App;
	}
}

const RootComponent = getRootComponent();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<RootComponent />
	</React.StrictMode>,
);
