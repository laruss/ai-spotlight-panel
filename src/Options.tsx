import { Check, Loader2, RefreshCw } from "lucide-react";
import { Button } from "./components/ui/button";
import { Label } from "./components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./components/ui/select";
import { Switch } from "./components/ui/switch";
import { useOllamaModels } from "./hooks/useOllamaModels";
import { useSettings } from "./hooks/useSettings";

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

			{/* Saving Indicator */}
			{isSaving && (
				<div className="options-saving">
					<Loader2 className="h-3 w-3 animate-spin" />
					<span>Saving...</span>
				</div>
			)}

			<div className="options-content">
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
			</div>
		</main>
	);
}

export default Options;
