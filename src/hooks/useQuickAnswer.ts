import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSettingsSnapshot, useSettingsReader } from "./useSettings";

interface UseQuickAnswerReturn {
	answer: string | null;
	isLoading: boolean;
	error: string | null;
}

export function useQuickAnswer(
	text: string,
	debounceMs = 1000,
): UseQuickAnswerReturn {
	const [answer, setAnswer] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef(false);
	const {
		ollamaModel,
		enableThinking,
		webSearchApiUrl,
		webSearchApiKey,
		isLoading: settingsLoading,
	} = useSettingsReader();

	const getQuickAnswer = useCallback(
		async (
			inputText: string,
			model: string,
			think: boolean,
			searchApiUrl: string,
			searchApiKey: string,
		) => {
			console.log("[useQuickAnswer] getQuickAnswer called with:", {
				model,
				think,
				textLength: inputText.length,
				hasWebSearchApiKey: Boolean(searchApiKey),
			});

			// Skip if no model is configured
			if (!model) {
				console.log("[useQuickAnswer] No model configured, skipping");
				setAnswer(null);
				setIsLoading(false);
				setError(null);
				return;
			}

			// Skip empty text or very short queries
			if (!inputText.trim() || inputText.trim().length < 2) {
				setAnswer(null);
				setIsLoading(false);
				setError(null);
				return;
			}

			abortRef.current = false;
			setIsLoading(true);
			setError(null);

			try {
				const latestSettings = await getSettingsSnapshot();
				const effectiveModel = latestSettings.ollamaModel || model;
				const effectiveThinking = latestSettings.enableThinking;
				const effectiveSearchApiUrl =
					latestSettings.webSearchApiUrl || searchApiUrl;
				const effectiveSearchApiKey =
					latestSettings.webSearchApiKey || searchApiKey;

				console.log(
					"[useQuickAnswer] Invoking quick_answer with enableThinking:",
					effectiveThinking,
				);
				const result = await invoke<string>("quick_answer", {
					text: inputText,
					model: effectiveModel,
					enableThinking: effectiveThinking,
					webSearchApiUrl: effectiveSearchApiUrl,
					webSearchApiKey: effectiveSearchApiKey,
				});

				if (abortRef.current) return;

				setAnswer(result);
				setError(null);
			} catch (err) {
				if (abortRef.current) return;

				const errorMessage = err instanceof Error ? err.message : String(err);
				if (errorMessage === "Cancelled") {
					setAnswer(null);
					setError(null);
					return;
				}
				console.error("Quick answer error:", errorMessage);
				setError(errorMessage);
				setAnswer(null);
			} finally {
				if (!abortRef.current) {
					setIsLoading(false);
				}
			}
		},
		[],
	);

	useEffect(() => {
		// Don't run while settings are loading
		if (settingsLoading) {
			return;
		}

		// Don't run if no model is configured
		if (!ollamaModel) {
			setAnswer(null);
			setIsLoading(false);
			setError(null);
			return;
		}

		const timeoutId = setTimeout(() => {
			getQuickAnswer(
				text,
				ollamaModel,
				enableThinking,
				webSearchApiUrl,
				webSearchApiKey,
			);
		}, debounceMs);

		return () => {
			clearTimeout(timeoutId);
			abortRef.current = true;
			setAnswer(null);
			setIsLoading(false);
			setError(null);
			void invoke("cancel_quick_answer").catch(() => {});
		};
	}, [
		text,
		debounceMs,
		getQuickAnswer,
		ollamaModel,
		enableThinking,
		webSearchApiUrl,
		webSearchApiKey,
		settingsLoading,
	]);

	return { answer, isLoading, error };
}
