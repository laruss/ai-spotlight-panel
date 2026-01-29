import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { QuickAnswerDropdown } from "./components/QuickAnswerDropdown";
import { TranslationDropdown } from "./components/TranslationDropdown";
import { useQuickAnswer } from "./hooks/useQuickAnswer";
import { useTranslation } from "./hooks/useTranslation";

const BASE_HEIGHT = 68;
const DROPDOWN_HEIGHT = 60;
const PADDING = 8; // 2 * p-2 (8px padding)
const MARGIN = 8; // margin-top of dropdowns

function App() {
	const [query, setQuery] = useState("");
	const [quickAnswerHeight, setQuickAnswerHeight] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const {
		translation,
		isLoading: translationLoading,
		error: translationError,
	} = useTranslation(query);
	const {
		answer,
		isLoading: answerLoading,
		error: answerError,
	} = useQuickAnswer(query);

	// Determine if dropdowns should be visible
	const showTranslation = translation || translationLoading || translationError;
	const showQuickAnswer = answer || answerLoading || answerError;

	// Callback to update quick answer height
	const handleQuickAnswerHeightChange = useCallback((height: number) => {
		setQuickAnswerHeight(height);
	}, []);

	// Resize window based on dropdown visibility and content height
	useEffect(() => {
		const appWindow = getCurrentWindow();
		let newHeight = BASE_HEIGHT + PADDING;

		if (showTranslation) {
			newHeight += DROPDOWN_HEIGHT + MARGIN;
		}
		if (showQuickAnswer && quickAnswerHeight > 0) {
			newHeight += quickAnswerHeight + MARGIN;
		}

		appWindow.setSize(new LogicalSize(680, newHeight));
	}, [showTranslation, showQuickAnswer, quickAnswerHeight]);

	useEffect(() => {
		const appWindow = getCurrentWindow();

		// Hide spotlight window and clear input
		const hideSpotlight = async () => {
			setQuery("");
			// Reset window height
			await appWindow.setSize(new LogicalSize(680, BASE_HEIGHT + PADDING));
			await appWindow.hide();
		};

		// Handle Escape key
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				hideSpotlight();
			}
		};

		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	// Focus input whenever the component renders (window shown)
	useEffect(() => {
		inputRef.current?.focus();
	});

	const handleCopied = () => {
		setQuery("");
	};

	return (
		<main className="h-full w-full p-2">
			<div className="spotlight-container flex h-[52px] w-full items-center gap-4 px-5">
				<Search className="spotlight-icon h-6 w-6 shrink-0" />
				<input
					ref={inputRef}
					type="text"
					className="spotlight-input w-full"
					placeholder="AI Spotlight"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
			</div>

			<TranslationDropdown
				translation={translation}
				isLoading={translationLoading}
				error={translationError}
				onCopied={handleCopied}
			/>

			<QuickAnswerDropdown
				answer={answer}
				isLoading={answerLoading}
				error={answerError}
				onHeightChange={handleQuickAnswerHeightChange}
			/>
		</main>
	);
}

export default App;
