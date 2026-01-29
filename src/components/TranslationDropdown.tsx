import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Languages, Loader2 } from "lucide-react";

interface TranslationDropdownProps {
	translation: {
		text: string;
		detectedLanguage: string;
	} | null;
	isLoading: boolean;
	error: string | null;
	onCopied: () => void;
}

export function TranslationDropdown({
	translation,
	isLoading,
	error,
	onCopied,
}: TranslationDropdownProps) {
	const handleClick = async () => {
		if (!translation) return;

		try {
			// Copy translation to clipboard
			await writeText(translation.text);

			// Show toast notification
			await invoke("show_toast", { message: "Translation copied" });

			// Call the onCopied callback (will hide window and clear input)
			onCopied();

			// Hide the spotlight window
			const appWindow = getCurrentWindow();
			await appWindow.hide();
		} catch (err) {
			console.error("Failed to copy translation:", err);
		}
	};

	// Don't render if no translation, not loading, and no error
	if (!translation && !isLoading && !error) {
		return null;
	}

	return (
		<div className="translation-dropdown">
			{isLoading && (
				<div className="translation-item translation-loading">
					<Loader2 className="translation-icon h-5 w-5 animate-spin" />
					<span className="translation-text">Translating...</span>
				</div>
			)}

			{error && !isLoading && (
				<div className="translation-item translation-error">
					<Languages className="translation-icon h-5 w-5" />
					<div className="translation-content">
						<span className="translation-text">Translation failed</span>
						<span className="translation-lang">{error}</span>
					</div>
				</div>
			)}

			{translation && !isLoading && (
				<button
					type="button"
					className="translation-item translation-result"
					onClick={handleClick}
				>
					<Languages className="translation-icon h-5 w-5" />
					<div className="translation-content">
						<span className="translation-text">{translation.text}</span>
						<span className="translation-lang">
							from {translation.detectedLanguage.toUpperCase()}
						</span>
					</div>
				</button>
			)}
		</div>
	);
}
