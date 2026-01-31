import { invoke } from "@tauri-apps/api/core";
import { emit, emitTo } from "@tauri-apps/api/event";
import { LazyStore } from "@tauri-apps/plugin-store";
import { useCallback, useEffect, useRef, useState } from "react";

export interface Settings {
	ollamaModel: string;
	enableThinking: boolean;
	webSearchApiUrl: string;
	webSearchApiKey: string;
	translationSecondLanguage: string;
}

const DEFAULT_SETTINGS: Settings = {
	ollamaModel: "",
	enableThinking: true,
	webSearchApiUrl: "",
	webSearchApiKey: "",
	translationSecondLanguage: "",
};

const STORE_PATH = "settings.json";
const SAVE_DEBOUNCE_MS = 250;
const SENSITIVE_SETTING_KEYS = new Set<keyof Settings>(["webSearchApiKey"]);

// Singleton store instance
let storeInstance: LazyStore | null = null;

function getStore(): LazyStore {
	if (!storeInstance) {
		storeInstance = new LazyStore(STORE_PATH);
	}
	return storeInstance;
}

export async function getSettingsSnapshot(): Promise<Settings> {
	const store = getStore();
	await store.init();
	await store.reload();

	const storedModel = await store.get<string>("ollamaModel");
	const storedEnableThinking = await store.get<boolean>("enableThinking");
	const storedWebSearchApiUrl = await store.get<string>("webSearchApiUrl");
	const storedWebSearchApiKey = await store.get<string>("webSearchApiKey");
	const storedTranslationSecondLanguage = await store.get<string>(
		"translationSecondLanguage",
	);

	return {
		...DEFAULT_SETTINGS,
		ollamaModel: storedModel ?? DEFAULT_SETTINGS.ollamaModel,
		enableThinking: storedEnableThinking ?? DEFAULT_SETTINGS.enableThinking,
		webSearchApiUrl: storedWebSearchApiUrl ?? DEFAULT_SETTINGS.webSearchApiUrl,
		webSearchApiKey: storedWebSearchApiKey ?? DEFAULT_SETTINGS.webSearchApiKey,
		translationSecondLanguage:
			storedTranslationSecondLanguage ??
			DEFAULT_SETTINGS.translationSecondLanguage,
	};
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
				const storedWebSearchApiUrl =
					await store.get<string>("webSearchApiUrl");
				const storedWebSearchApiKey =
					await store.get<string>("webSearchApiKey");
				const storedTranslationSecondLanguage = await store.get<string>(
					"translationSecondLanguage",
				);

				const newSettings: Settings = { ...DEFAULT_SETTINGS };

				// Load enableThinking (default to true if not set)
				newSettings.enableThinking = storedEnableThinking ?? true;
				newSettings.webSearchApiUrl =
					typeof storedWebSearchApiUrl === "string"
						? storedWebSearchApiUrl
						: "";
				newSettings.webSearchApiKey =
					typeof storedWebSearchApiKey === "string"
						? storedWebSearchApiKey
						: "";
				newSettings.translationSecondLanguage =
					typeof storedTranslationSecondLanguage === "string"
						? storedTranslationSecondLanguage
						: "";

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

		console.log("[useSettings] saveSettings called with:", {
			...newSettings,
			webSearchApiKey: newSettings.webSearchApiKey
				? "[redacted]"
				: newSettings.webSearchApiKey,
		});

		try {
			for (const [key, value] of Object.entries(newSettings)) {
				const settingKey = key as keyof Settings;
				const loggedValue = SENSITIVE_SETTING_KEYS.has(settingKey)
					? value
						? "[redacted]"
						: value
					: value;
				console.log("[useSettings] Saving to store:", key, "=", loggedValue);
				await store.set(key, value);
			}
			await store.save();
			console.log("[useSettings] Store saved successfully");
			setSaveSuccess(true);
			// Reset success indicator after 2 seconds
			setTimeout(() => setSaveSuccess(false), 2000);
			const payload = {
				keys: Object.keys(newSettings),
			};
			try {
				await invoke("log_settings_update", { values: newSettings });
				await emit("settings://updated", payload);
				await emitTo("spotlight", "settings://updated", payload);
			} catch (err) {
				console.error("[useSettings] Post-save notifications failed:", err);
			}
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
	webSearchApiUrl: string;
	webSearchApiKey: string;
	translationSecondLanguage: string;
	isLoading: boolean;
} {
	const [settings, setSettings] = useState<{
		ollamaModel: string;
		enableThinking: boolean;
		webSearchApiUrl: string;
		webSearchApiKey: string;
		translationSecondLanguage: string;
	}>({
		ollamaModel: "",
		enableThinking: true,
		webSearchApiUrl: "",
		webSearchApiKey: "",
		translationSecondLanguage: "",
	});
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const loadSettings = async () => {
			const store = getStore();
			try {
				const storedModel = await store.get<string>("ollamaModel");
				const storedEnableThinking = await store.get<boolean>("enableThinking");
				const storedWebSearchApiUrl =
					await store.get<string>("webSearchApiUrl");
				const storedWebSearchApiKey =
					await store.get<string>("webSearchApiKey");
				const storedTranslationSecondLanguage = await store.get<string>(
					"translationSecondLanguage",
				);

				console.log("[useSettingsReader] Loaded from store:", {
					storedModel,
					storedEnableThinking,
					storedWebSearchApiUrl,
					hasWebSearchApiKey: Boolean(storedWebSearchApiKey),
				});

				let ollamaModel = "";
				const enableThinking = storedEnableThinking ?? true;
				const webSearchApiUrl =
					typeof storedWebSearchApiUrl === "string"
						? storedWebSearchApiUrl
						: "";
				const webSearchApiKey =
					typeof storedWebSearchApiKey === "string"
						? storedWebSearchApiKey
						: "";
				const translationSecondLanguage =
					typeof storedTranslationSecondLanguage === "string"
						? storedTranslationSecondLanguage
						: "";

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
					webSearchApiUrl,
					hasWebSearchApiKey: Boolean(webSearchApiKey),
					translationSecondLanguage,
				});
				setSettings({
					ollamaModel,
					enableThinking,
					webSearchApiUrl,
					webSearchApiKey,
					translationSecondLanguage,
				});
			} catch (err) {
				console.error("Failed to load settings:", err);
				setSettings({
					ollamaModel: "",
					enableThinking: true,
					webSearchApiUrl: "",
					webSearchApiKey: "",
					translationSecondLanguage: "",
				});
			} finally {
				setIsLoading(false);
			}
		};

		loadSettings();
	}, []);

	return { ...settings, isLoading };
}
