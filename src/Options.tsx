import { Check, Loader2, RefreshCw } from "lucide-react";
import type { ChangeEvent } from "react";
import { Button } from "./components/ui/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "./components/ui/combobox";
import { Label } from "./components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./components/ui/select";
import { Switch } from "./components/ui/switch";
import {
	type TranslationLanguage,
	translationLanguages,
} from "./data/translationLanguages";
import { useOllamaModels } from "./hooks/useOllamaModels";
import { useSettings } from "./hooks/useSettings";

const translationLanguageValues = new Set(
	translationLanguages.map((language) => language.value),
);

const resolveTranslationLanguageValue = (value: unknown): string => {
	if (!value) {
		return "";
	}
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "object" && "value" in value) {
		const candidate = (value as { value?: unknown }).value;
		return typeof candidate === "string" ? candidate : "";
	}
	return "";
};

function Options() {
	const { settings, updateSetting, isLoading, isSaving, saveSuccess } =
		useSettings();
	const {
		models,
		isLoading: modelsLoading,
		error: modelsError,
		refreshSuccess: modelsRefreshSuccess,
		refetch,
	} = useOllamaModels();

	const handleModelChange = (value: string) => {
		// Handle the special "none" value
		const modelValue = value === "__none__" ? "" : value;
		updateSetting("ollamaModel", modelValue);
	};

	const handleRefresh = async () => {
		await refetch();
	};

	const handleThinkingToggle = (checked: boolean) => {
		console.log("[Options] handleThinkingToggle called with:", checked);
		updateSetting("enableThinking", checked);
	};

	const handleWebSearchApiUrlChange = (
		event: ChangeEvent<HTMLInputElement>,
	) => {
		updateSetting("webSearchApiUrl", event.target.value);
	};

	const handleWebSearchApiKeyChange = (
		event: ChangeEvent<HTMLInputElement>,
	) => {
		updateSetting("webSearchApiKey", event.target.value);
	};

	const selectedTranslationLanguage =
		translationLanguages.find(
			(language) => language.value === settings.translationSecondLanguage,
		) ?? null;

	const handleTranslationLanguageChange = (
		language: TranslationLanguage | string | null,
	) => {
		const resolvedValue = resolveTranslationLanguageValue(language);
		if (!resolvedValue) {
			updateSetting("translationSecondLanguage", "");
			return;
		}

		if (!translationLanguageValues.has(resolvedValue)) {
			return;
		}

		updateSetting("translationSecondLanguage", resolvedValue);
	};

	if (isLoading) {
		return (
			<main className="options-window">
				<div className="flex h-full items-center justify-center">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			</main>
		);
	}

	return (
		<main className="options-window">
			{/* Saving Indicator */}
			{isSaving && (
				<div className="options-saving">
					<Loader2 className="h-3 w-3 animate-spin" />
					<span>Saving...</span>
				</div>
			)}

			<div className="options-content">
				{/* Settings Saved Toast */}
				<div
					className={`options-toast ${saveSuccess ? "options-toast-visible" : ""}`}
				>
					<Check className="h-4 w-4 text-green-500" />
					<span>Settings saved</span>
				</div>

				{/* Models Reloaded Toast */}
				<div
					className={`options-toast ${modelsRefreshSuccess ? "options-toast-visible" : ""}`}
				>
					<Check className="h-4 w-4 text-green-500" />
					<span>Models reloaded</span>
				</div>

				<h1 className="options-title">Options</h1>

				<div className="options-section">
					<h2 className="options-section-title">AI Model</h2>

					<div className="options-field">
						<Label htmlFor="model-select">Ollama Model</Label>
						<div className="options-field-row">
							<Select
								value={settings.ollamaModel || "__none__"}
								onValueChange={handleModelChange}
								disabled={modelsLoading}
							>
								<SelectTrigger id="model-select" className="options-select">
									<SelectValue placeholder="Select a model" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__none__">
										<span className="text-muted-foreground">
											No model selected
										</span>
									</SelectItem>
									{models.map((model) => (
										<SelectItem key={model} value={model}>
											{model}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Button
								variant="outline"
								size="icon"
								onClick={handleRefresh}
								disabled={modelsLoading}
								title="Refresh models list"
								className="options-refresh-btn"
							>
								<RefreshCw
									className={`h-4 w-4 ${modelsLoading ? "animate-spin" : ""}`}
								/>
							</Button>
						</div>

						{modelsError && (
							<p className="options-error">
								Failed to load models: {modelsError}
							</p>
						)}

						{!modelsLoading && models.length === 0 && !modelsError && (
							<p className="options-hint">
								No models found. Make sure Ollama is running.
							</p>
						)}

						{!settings.ollamaModel && (
							<p className="options-warning">
								Please add a model to Ollama to enable AI responses.
							</p>
						)}
					</div>

					<div className="options-field options-field-toggle">
						<div className="options-toggle-row">
							<Label htmlFor="thinking-toggle">Enable Thinking</Label>
							<Switch
								id="thinking-toggle"
								checked={settings.enableThinking}
								onCheckedChange={handleThinkingToggle}
							/>
						</div>
						<p className="options-hint">
							Allow the model to think through problems before responding. May
							improve answer quality but takes longer.
						</p>
					</div>
				</div>

				<div className="options-section">
					<h2 className="options-section-title">Web Search</h2>
					<p className="options-hint options-section-hint">
						Used by the web_search tool to fetch fresh info from the internet
						for quick answers.
					</p>

					<div className="options-field">
						<Label htmlFor="web-search-url">Search API URL</Label>
						<input
							id="web-search-url"
							type="url"
							className="options-input"
							placeholder="Enter search API URL"
							value={settings.webSearchApiUrl}
							onChange={handleWebSearchApiUrlChange}
						/>
						<p className="options-hint">
							Base endpoint used for the web_search tool.
						</p>
					</div>

					<div className="options-field">
						<Label htmlFor="web-search-key">Search API Key</Label>
						<input
							id="web-search-key"
							type="password"
							className="options-input"
							placeholder="Enter API key"
							autoComplete="new-password"
							value={settings.webSearchApiKey}
							onChange={handleWebSearchApiKeyChange}
						/>
						<p className="options-hint">Stored locally in app settings.</p>
					</div>
				</div>

				<div className="options-section">
					<h2 className="options-section-title">Translation</h2>
					<p className="options-hint options-section-hint">
						Non-English text is translated to English. When your input is
						English, it is translated to the language selected below.
					</p>

					<div className="options-field">
						<Label htmlFor="translation-language">Second language</Label>
						<Combobox
							items={translationLanguages}
							value={selectedTranslationLanguage}
							onValueChange={(value) => {
								handleTranslationLanguageChange(
									(value as TranslationLanguage | string | null) ?? null,
								);
							}}
							itemToStringLabel={(item) =>
								(item as TranslationLanguage | null)?.label ?? ""
							}
							itemToStringValue={(item) =>
								(item as TranslationLanguage | null)?.value ?? ""
							}
						>
							<ComboboxInput
								id="translation-language"
								className="options-combobox"
								placeholder="Select language"
								showClear={Boolean(selectedTranslationLanguage)}
							/>
							<ComboboxContent className="options-combobox-content">
								<ComboboxEmpty>No languages found.</ComboboxEmpty>
								<ComboboxList>
									{(language: TranslationLanguage) => (
										<ComboboxItem key={language.value} value={language}>
											{language.label}
										</ComboboxItem>
									)}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
						<p className="options-hint">
							Leave empty to keep English unchanged.
						</p>
					</div>
				</div>
			</div>
		</main>
	);
}

export default Options;
