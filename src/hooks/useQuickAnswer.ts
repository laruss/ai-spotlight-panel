import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSettingsReader } from "./useSettings";

interface UseQuickAnswerReturn {
	answer: string | null;
	isLoading: boolean;
	error: string | null;
}

export function useQuickAnswer(
	text: string,
	debounceMs = 500,
): UseQuickAnswerReturn {
	const [answer, setAnswer] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef(false);
	const {
		ollamaModel,
		enableThinking,
		isLoading: settingsLoading,
	} = useSettingsReader();

	const getQuickAnswer = useCallback(
		async (inputText: string, model: string, think: boolean) => {
			console.log("[useQuickAnswer] getQuickAnswer called with:", {
				model,
				think,
				textLength: inputText.length,
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
				console.log(
					"[useQuickAnswer] Invoking quick_answer with enableThinking:",
					think,
				);
				const result = await invoke<string>("quick_answer", {
					text: inputText,
					model: model,
					enableThinking: think,
				});

				if (abortRef.current) return;

				setAnswer(result);
				setError(null);
			} catch (err) {
				if (abortRef.current) return;

				const errorMessage = err instanceof Error ? err.message : String(err);
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
			getQuickAnswer(text, ollamaModel, enableThinking);
		}, debounceMs);

		return () => {
			clearTimeout(timeoutId);
			abortRef.current = true;
		};
	}, [
		text,
		debounceMs,
		getQuickAnswer,
		ollamaModel,
		enableThinking,
		settingsLoading,
	]);

	return { answer, isLoading, error };
}
