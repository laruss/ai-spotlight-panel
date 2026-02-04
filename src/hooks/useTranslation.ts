import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSettingsReader } from "./useSettings";

interface TranslationResult {
	text: string;
	detectedLanguage: string;
}

interface RustTranslationResult {
	text: string;
	detected_language: string;
}

interface UseTranslationReturn {
	translation: TranslationResult | null;
	isLoading: boolean;
	error: string | null;
}

export function useTranslation(
	text: string,
	debounceMs = 300,
): UseTranslationReturn {
	const [translation, setTranslation] = useState<TranslationResult | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef(false);
	const { translationSecondLanguage, isLoading: settingsLoading } =
		useSettingsReader();

	const translateText = useCallback(
		async (inputText: string, targetLanguage: string) => {
			// Skip empty text
			if (!inputText.trim()) {
				setTranslation(null);
				setIsLoading(false);
				setError(null);
				return;
			}

			abortRef.current = false;
			setIsLoading(true);
			setError(null);

			try {
				const result = await invoke<RustTranslationResult>("translate_text", {
					text: inputText,
					targetLanguage,
				});

				if (abortRef.current) return;

				setTranslation({
					text: result.text,
					detectedLanguage: result.detected_language,
				});
				setError(null);
			} catch (err) {
				if (abortRef.current) return;

				const errorMessage = err instanceof Error ? err.message : String(err);
				if (errorMessage === "Cancelled") {
					setTranslation(null);
					setError(null);
					return;
				}

				// "Source is English" is not really an error, just means no translation needed
				if (errorMessage.includes("Source is English")) {
					setTranslation(null);
					setError(null);
				} else {
					console.error("Translation error:", errorMessage);
					setError(errorMessage);
					setTranslation(null);
				}
			} finally {
				if (!abortRef.current) {
					setIsLoading(false);
				}
			}
		},
		[],
	);

	useEffect(() => {
		if (settingsLoading) {
			return;
		}

		const timeoutId = setTimeout(() => {
			translateText(text, translationSecondLanguage);
		}, debounceMs);

		return () => {
			clearTimeout(timeoutId);
			abortRef.current = true;
			setTranslation(null);
			setIsLoading(false);
			setError(null);
			void invoke("cancel_translate_text").catch(() => {});
		};
	}, [
		text,
		debounceMs,
		translateText,
		translationSecondLanguage,
		settingsLoading,
	]);

	return { translation, isLoading, error };
}
