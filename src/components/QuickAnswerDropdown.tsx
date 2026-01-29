import { Bot, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

interface QuickAnswerDropdownProps {
	answer: string | null;
	isLoading: boolean;
	error: string | null;
	onHeightChange?: (height: number) => void;
}

export function QuickAnswerDropdown({
	answer,
	isLoading,
	error,
	onHeightChange,
}: QuickAnswerDropdownProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	// Measure and report height changes after content renders
	useEffect(() => {
		if (containerRef.current && onHeightChange) {
			// Use requestAnimationFrame to ensure DOM has updated
			requestAnimationFrame(() => {
				if (containerRef.current) {
					const height = containerRef.current.offsetHeight;
					onHeightChange(height);
				}
			});
		}
	});

	// Report zero height when not visible
	useEffect(() => {
		if (!answer && !isLoading && !error && onHeightChange) {
			onHeightChange(0);
		}
	}, [answer, isLoading, error, onHeightChange]);

	// Don't render if no answer, not loading, and no error
	if (!answer && !isLoading && !error) {
		return null;
	}

	return (
		<div ref={containerRef} className="quick-answer-dropdown">
			{isLoading && (
				<div className="quick-answer-item quick-answer-loading">
					<Bot className="quick-answer-icon h-5 w-5" />
					<div className="quick-answer-content">
						<Loader2 className="h-4 w-4 animate-spin text-white/50" />
						<span className="quick-answer-text">Thinking...</span>
					</div>
				</div>
			)}

			{error && !isLoading && (
				<div className="quick-answer-item quick-answer-error">
					<Bot className="quick-answer-icon h-5 w-5" />
					<div className="quick-answer-content">
						<span className="quick-answer-text quick-answer-text-error">
							{error}
						</span>
					</div>
				</div>
			)}

			{answer && !isLoading && (
				<div className="quick-answer-item quick-answer-result">
					<Bot className="quick-answer-icon h-5 w-5" />
					<div className="quick-answer-content">
						<span className="quick-answer-text">{answer}</span>
					</div>
				</div>
			)}
		</div>
	);
}
