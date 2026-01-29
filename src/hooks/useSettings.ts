import { invoke } from "@tauri-apps/api/core";
import { LazyStore } from "@tauri-apps/plugin-store";
import { useCallback, useEffect, useRef, useState } from "react";

export interface Settings {
	ollamaModel: string;
	enableThinking: boolean;
}

const DEFAULT_SETTINGS: Settings = {
	ollamaModel: "",
	enableThinking: true,
};

const STORE_PATH = "settings.json";
const SAVE_DEBOUNCE_MS = 250;

// Singleton store instance
let storeInstance: LazyStore | null = null;

function getStore(): LazyStore {
	if (!storeInstance) {
		storeInstance = new LazyStore(STORE_PATH);
	}
	return storeInstance;
}

interface UseSettingsReturn {
	settings: Settings;
	updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
	isLoading: boolean;
	isSaving: boolean;
	saveSuccess: boolean;
}

export function useSettings(): UseSettingsReturn {
	const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingChangesRef = useRef<Partial<Settings>>({});
	const initializedRef = useRef(false);

	// Load settings from store
	useEffect(() => {
		const loadSettings = async () => {
			const store = getStore();

			try {
				const storedModel = await store.get<string>("ollamaModel");
				const storedEnableThinking = await store.get<boolean>("enableThinking");

				const newSettings: Settings = { ...DEFAULT_SETTINGS };

				// Load enableThinking (default to true if not set)
				newSettings.enableThinking = storedEnableThinking ?? true;

				// If we have a stored model that's not empty, use it
				if (storedModel) {
					newSettings.ollamaModel = storedModel;
				} else {
					// First run OR empty model: try to get first available model from Ollama
					try {
						const models = await invoke<string[]>("list_models");
						const firstModel = models.length > 0 ? models[0] : "";
						newSettings.ollamaModel = firstModel;
						// Save the initial setting
						await store.set("ollamaModel", firstModel);
						await store.save();
					} catch {
						// Ollama not available, keep empty model
						newSettings.ollamaModel = "";
						await store.set("ollamaModel", "");
						await store.save();
					}
				}

				setSettings(newSettings);
			} catch (err) {
				console.error("Failed to load settings:", err);
			} finally {
				setIsLoading(false);
				initializedRef.current = true;
			}
		};

		loadSettings();
	}, []);

	// Save settings to store with debounce
	const saveSettings = useCallback(async (newSettings: Partial<Settings>) => {
		const store = getStore();
		setIsSaving(true);
		setSaveSuccess(false);

		console.log("[useSettings] saveSettings called with:", newSettings);

		try {
			for (const [key, value] of Object.entries(newSettings)) {
				console.log("[useSettings] Saving to store:", key, "=", value);
				await store.set(key, value);
			}
			await store.save();
			console.log("[useSettings] Store saved successfully");
			setSaveSuccess(true);
			// Reset success indicator after 2 seconds
			setTimeout(() => setSaveSuccess(false), 2000);
		} catch (err) {
			console.error("Failed to save settings:", err);
		} finally {
			setIsSaving(false);
		}
	}, []);

	// Update a single setting with debounced save
	const updateSetting = useCallback(
		<K extends keyof Settings>(key: K, value: Settings[K]) => {
			// Update local state immediately
			setSettings((prev) => ({ ...prev, [key]: value }));

			// Accumulate pending changes
			pendingChangesRef.current[key] = value;

			// Clear existing timeout
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}

			// Set new timeout for debounced save
			saveTimeoutRef.current = setTimeout(() => {
				saveSettings(pendingChangesRef.current);
				pendingChangesRef.current = {};
			}, SAVE_DEBOUNCE_MS);
		},
		[saveSettings],
	);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
		};
	}, []);

	return { settings, updateSetting, isLoading, isSaving, saveSuccess };
}

// Hook for reading settings only (for use in other components like useQuickAnswer)
// Also performs initialization if no model is stored
export function useSettingsReader(): {
	ollamaModel: string;
	enableThinking: boolean;
	isLoading: boolean;
} {
	const [settings, setSettings] = useState<{
		ollamaModel: string;
		enableThinking: boolean;
	}>({
		ollamaModel: "",
		enableThinking: true,
	});
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const loadSettings = async () => {
			const store = getStore();
			try {
				const storedModel = await store.get<string>("ollamaModel");
				const storedEnableThinking = await store.get<boolean>("enableThinking");

				console.log("[useSettingsReader] Loaded from store:", {
					storedModel,
					storedEnableThinking,
				});

				let ollamaModel = "";
				const enableThinking = storedEnableThinking ?? true;

				console.log(
					"[useSettingsReader] enableThinking resolved to:",
					enableThinking,
				);

				// If we have a stored model that's not empty, use it
				if (storedModel) {
					ollamaModel = storedModel;
				} else {
					// First run OR empty model: try to get first available model from Ollama
					try {
						const models = await invoke<string[]>("list_models");
						const firstModel = models.length > 0 ? models[0] : "";
						ollamaModel = firstModel;
						// Save the initial setting
						await store.set("ollamaModel", firstModel);
						await store.save();
					} catch {
						// Ollama not available, keep empty model
						ollamaModel = "";
					}
				}

				console.log("[useSettingsReader] Final settings:", {
					ollamaModel,
					enableThinking,
				});
				setSettings({ ollamaModel, enableThinking });
			} catch (err) {
				console.error("Failed to load settings:", err);
				setSettings({ ollamaModel: "", enableThinking: true });
			} finally {
				setIsLoading(false);
			}
		};

		loadSettings();
	}, []);

	return { ...settings, isLoading };
}
