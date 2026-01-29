import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseOllamaModelsReturn {
	models: string[];
	isLoading: boolean;
	error: string | null;
	refreshSuccess: boolean;
	refetch: () => Promise<void>;
}

export function useOllamaModels(): UseOllamaModelsReturn {
	const [models, setModels] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [refreshSuccess, setRefreshSuccess] = useState(false);
	const isInitialLoadRef = useRef(true);

	const fetchModels = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const result = await invoke<string[]>("list_models");
			setModels(result);
			// Show success toast only on manual refresh, not initial load
			if (!isInitialLoadRef.current) {
				setRefreshSuccess(true);
				setTimeout(() => setRefreshSuccess(false), 2000);
			}
			isInitialLoadRef.current = false;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			console.error("Failed to fetch Ollama models:", errorMessage);
			setError(errorMessage);
			setModels([]);
			isInitialLoadRef.current = false;
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchModels();
	}, [fetchModels]);

	return { models, isLoading, error, refreshSuccess, refetch: fetchModels };
}
