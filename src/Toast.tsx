import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

function Toast() {
	const [message, setMessage] = useState("Translation copied");

	useEffect(() => {
		const unlisten = listen<string>("toast://message", (event) => {
			setMessage(event.payload);
		});

		return () => {
			unlisten.then((fn) => fn());
		};
	}, []);

	return (
		<main className="h-full w-full p-1">
			<div className="toast-container flex h-full w-full items-center justify-center gap-2 px-4">
				<span className="toast-text">{message}</span>
			</div>
		</main>
	);
}

export default Toast;
