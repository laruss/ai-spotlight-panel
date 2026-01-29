use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{
	menu::{Menu, MenuItem},
	tray::TrayIconBuilder,
	Emitter, Manager, WebviewWindowBuilder,
};

// Data structures for Ollama API
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
	pub role: String,
	pub content: String,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCall {
	#[serde(rename = "type")]
	pub call_type: Option<String>,
	pub function: ToolCallFunction,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCallFunction {
	#[serde(skip_serializing_if = "Option::is_none")]
	pub index: Option<u32>,
	pub name: String,
	pub arguments: serde_json::Value,
}

// Tool definition for Ollama
#[derive(Debug, Serialize, Deserialize, Clone)]
struct Tool {
	#[serde(rename = "type")]
	tool_type: String,
	function: ToolFunction,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ToolFunction {
	name: String,
	description: String,
	parameters: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatRequest {
	model: String,
	messages: Vec<ChatMessage>,
	stream: bool,
}

// Extended chat request with tools support
#[derive(Debug, Serialize, Deserialize)]
struct ChatRequestWithTools {
	model: String,
	messages: serde_json::Value, // Use Value to support mixed message types
	stream: bool,
	#[serde(skip_serializing_if = "Option::is_none")]
	tools: Option<Vec<Tool>>,
	think: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatResponse {
	message: Option<ChatMessage>,
	done: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct ModelInfo {
	name: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ModelsResponse {
	models: Vec<ModelInfo>,
}

// Command to list available models from Ollama
#[tauri::command]
async fn list_models() -> Result<Vec<String>, String> {
	let client = reqwest::Client::new();
	let response = client
		.get("http://127.0.0.1:11434/api/tags")
		.send()
		.await
		.map_err(|e| format!("Failed to connect to Ollama: {}. Make sure Ollama is running.", e))?;

	// Read response body as bytes and parse JSON manually
	let body_bytes = response
		.bytes()
		.await
		.map_err(|e| format!("Failed to read response body: {}", e))?;

	let models_response: ModelsResponse = serde_json::from_slice(&body_bytes)
		.map_err(|e| format!("Failed to parse models response: {}", e))?;

	Ok(models_response
		.models
		.into_iter()
		.map(|m| m.name)
		.collect())
}

// System prompt for quick AI responses
const QUICK_ANSWER_SYSTEM_PROMPT: &str = r#"You are a web search agent. Your only job is to answer the user's query using fresh information from the internet.

Rules:
- Always call the tool `web_search` exactly once per user query.
- Use the tool results as your primary source of truth.
- Return a single, direct answer to the user based only on the tool results and common knowledge needed for readability.
- Do not ask follow-up questions. Do not start or continue a conversation. Do not add suggestions or next steps.
- If the results are conflicting, summarize the consensus and note uncertainty briefly.
- If the results are insufficient, say so in one sentence and state what could not be verified.

Output:
- Respond with only the final answer text (no tool logs, no reasoning, no citations unless the application requires them)."#;

// Web search tool definition
fn get_web_search_tool() -> Tool {
	Tool {
		tool_type: "function".to_string(),
		function: ToolFunction {
			name: "web_search".to_string(),
			description: "Search the internet for current information. Use this when you need to find up-to-date information or facts you don't know.".to_string(),
			parameters: serde_json::json!({
				"type": "object",
				"required": ["query"],
				"properties": {
					"query": {
						"type": "string",
						"description": "The search query to look up on the internet"
					}
				}
			}),
		},
	}
}

// Execute web search using the configured search API
async fn execute_web_search(query: &str) -> Result<String, String> {
	let api_url = std::env::var("SEARCH_API_URL")
		.unwrap_or_else(|_| "https://search.mobb.space/search".to_string());
	let api_key = std::env::var("SEARCH_API_KEY")
		.map_err(|_| "SEARCH_API_KEY not configured in environment")?;

	let client = reqwest::Client::new();
	let response = client
		.post(format!("{}?format=json", api_url))
		.header("Authorization", format!("Bearer {}", api_key))
		.header("Content-Type", "application/x-www-form-urlencoded")
		.body(format!("q={}", urlencoding::encode(query)))
		.send()
		.await
		.map_err(|e| format!("Search request failed: {}", e))?;

	if !response.status().is_success() {
		return Err(format!("Search API error: {}", response.status()));
	}

	response
		.text()
		.await
		.map_err(|e| format!("Failed to read search response: {}", e))
}

// Command for quick, non-streaming AI response with tool calling support
#[tauri::command]
async fn quick_answer(text: String, model: String, enable_thinking: bool) -> Result<String, String> {
	log::info!("[quick_answer] Called with model={}, enable_thinking={}", model, enable_thinking);
	
	if text.trim().is_empty() {
		log::warn!("[quick_answer] Empty text provided");
		return Err("Empty text".to_string());
	}

	let client = reqwest::Client::new();
	let tools = vec![get_web_search_tool()];

	// Build initial messages
	// For Qwen3 and similar models, add /no_think or /think suffix to control thinking mode
	let thinking_suffix = if enable_thinking { " /think" } else { " /no_think" };
	let user_content = format!("{}{}", text, thinking_suffix);
	
	let system_msg = serde_json::json!({
		"role": "system",
		"content": QUICK_ANSWER_SYSTEM_PROMPT
	});
	let user_msg = serde_json::json!({
		"role": "user",
		"content": user_content
	});
	let mut messages = vec![system_msg, user_msg];

	// First request with tools
	let request_body = ChatRequestWithTools {
		model: model.clone(),
		messages: serde_json::Value::Array(messages.clone()),
		stream: false,
		tools: Some(tools.clone()),
		think: enable_thinking,
	};

	let json_body = serde_json::to_string(&request_body)
		.map_err(|e| format!("Failed to serialize request: {}", e))?;

	log::info!("[quick_answer] Sending request to Ollama with think={}", enable_thinking);
	log::info!("[quick_answer] Full request body: {}", json_body);

	let response = client
		.post("http://127.0.0.1:11434/api/chat")
		.header("Content-Type", "application/json")
		.body(json_body)
		.send()
		.await
		.map_err(|e| format!("Failed to connect to Ollama: {}. Make sure Ollama is running.", e))?;

	if !response.status().is_success() {
		return Err(format!("Ollama API error: {}", response.status()));
	}

	let body_bytes = response
		.bytes()
		.await
		.map_err(|e| format!("Failed to read response: {}", e))?;

	let chat_response: ChatResponse = serde_json::from_slice(&body_bytes)
		.map_err(|e| format!("Failed to parse response: {}", e))?;

	// Check if the model wants to call tools
	if let Some(ref message) = chat_response.message {
		if let Some(ref tool_calls) = message.tool_calls {
			if !tool_calls.is_empty() {
				// Process tool calls
				let mut tool_results = Vec::new();

				for tool_call in tool_calls {
					if tool_call.function.name == "web_search" {
						// Extract the query from arguments
						let query = tool_call.function.arguments
							.get("query")
							.and_then(|v| v.as_str())
							.unwrap_or("");

						if !query.is_empty() {
							match execute_web_search(query).await {
								Ok(result) => {
									tool_results.push((tool_call.function.name.clone(), result));
								}
								Err(e) => {
									tool_results.push((tool_call.function.name.clone(), format!("Search failed: {}", e)));
								}
							}
						}
					}
				}

				// Add assistant message with tool calls to conversation
				let assistant_msg = serde_json::json!({
					"role": "assistant",
					"content": message.content.clone(),
					"tool_calls": message.tool_calls
				});
				messages.push(assistant_msg);

				// Add tool results to conversation
				for (tool_name, result) in tool_results {
					let tool_msg = serde_json::json!({
						"role": "tool",
						"tool_name": tool_name,
						"content": result
					});
					messages.push(tool_msg);
				}

				// Make second request with tool results
				let follow_up_request = ChatRequestWithTools {
					model: model.clone(),
					messages: serde_json::Value::Array(messages),
					stream: false,
					tools: Some(tools),
					think: enable_thinking,
				};

				let json_body = serde_json::to_string(&follow_up_request)
					.map_err(|e| format!("Failed to serialize follow-up request: {}", e))?;

				let response = client
					.post("http://127.0.0.1:11434/api/chat")
					.header("Content-Type", "application/json")
					.body(json_body)
					.send()
					.await
					.map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

				if !response.status().is_success() {
					return Err(format!("Ollama API error: {}", response.status()));
				}

				let body_bytes = response
					.bytes()
					.await
					.map_err(|e| format!("Failed to read follow-up response: {}", e))?;

				let final_response: ChatResponse = serde_json::from_slice(&body_bytes)
					.map_err(|e| format!("Failed to parse follow-up response: {}", e))?;

				return final_response
					.message
					.map(|m| m.content)
					.ok_or_else(|| "No response from model".to_string());
			}
		}
	}

	// No tool calls, return direct response
	chat_response
		.message
		.map(|m| m.content)
		.ok_or_else(|| "No response from model".to_string())
}

// Command to stream chat responses from Ollama
#[tauri::command]
async fn chat_stream(
	app: tauri::AppHandle,
	model: String,
	messages: Vec<ChatMessage>,
) -> Result<(), String> {
	use futures_util::StreamExt;

	let client = reqwest::Client::new();

	// Create the request body
	let request_body = ChatRequest {
		model,
		messages,
		stream: true,
	};

	// Serialize request body to JSON manually
	let json_body = serde_json::to_string(&request_body)
		.map_err(|e| format!("Failed to serialize request: {}", e))?;

	// Make the POST request
	let response = client
		.post("http://127.0.0.1:11434/api/chat")
		.header("Content-Type", "application/json")
		.body(json_body)
		.send()
		.await
		.map_err(|e| format!("Failed to connect to Ollama: {}. Make sure Ollama is running.", e))?;

	// Get the response as a stream of bytes
	let mut stream = response.bytes_stream();

	// Buffer for incomplete lines
	let mut buffer = Vec::new();

	// Process the stream line by line
	while let Some(chunk) = stream.next().await {
		let bytes = chunk.map_err(|e| format!("Stream error: {}", e))?;

		// Add bytes to buffer
		buffer.extend_from_slice(&bytes);

		// Process all complete lines in the buffer
		while let Some(newline_pos) = buffer.iter().position(|&b| b == b'\n') {
			// Extract the line
			let line: Vec<u8> = buffer.drain(..=newline_pos).collect();

			// Skip empty lines
			if line.len() <= 1 {
				continue;
			}

			// Try to parse as JSON
			match serde_json::from_slice::<ChatResponse>(&line) {
				Ok(chat_response) => {
					// Extract the token content
					if let Some(message) = &chat_response.message {
						if !message.content.is_empty() {
							// Emit the token to the frontend
							let _ = app.emit("ollama://token", message.content.clone());
						}
					}

					// Check if streaming is done
					if chat_response.done {
						let _ = app.emit("ollama://done", ());
						return Ok(());
					}
				}
				Err(e) => {
					eprintln!("Failed to parse JSON line: {}", e);
					// Continue processing other lines
				}
			}
		}
	}

	// Send done event if stream ended without explicit done flag
	let _ = app.emit("ollama://done", ());
	Ok(())
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
	format!("Hello, {}! You've been greeted from Rust!", name)
}

// Translation result structure
#[derive(Debug, Serialize, Deserialize)]
pub struct TranslationResult {
	pub text: String,
	pub detected_language: String,
}

// Command to translate text using Google Translate
#[tauri::command]
async fn translate_text(text: String) -> Result<TranslationResult, String> {
	if text.trim().is_empty() {
		return Err("Empty text".to_string());
	}

	let client = reqwest::Client::new();

	// Use the batch translate endpoint (more reliable, less rate-limited)
	let rpcids = "MkEWBc";
	let req_id: u32 = rand::random::<u32>() % 9000 + 1000;

	let query_params = format!(
		"rpcids={}&source-path=/&f.sid=&bl=&hl=en-US&soc-app=1&soc-platform=1&soc-device=1&_reqid={}&rt=c",
		rpcids, req_id
	);

	let url = format!(
		"https://translate.google.com/_/TranslateWebserverUi/data/batchexecute?{}",
		query_params
	);

	// Build the request body
	// Format: [[["MkEWBc","[[\"text\",\"auto\",\"en\",true],[null]]",null,"1"]]]
	let freq_inner = serde_json::json!([[&text, "auto", "en", true], [null]]);
	let freq = serde_json::json!([[[rpcids, freq_inner.to_string(), null, "0"]]]);
	let body = format!("f.req={}&", urlencoding::encode(&freq.to_string()));

	let response = client
		.post(&url)
		.header("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8")
		.body(body)
		.send()
		.await
		.map_err(|e| format!("Request failed: {}", e))?;

	if !response.status().is_success() {
		return Err(format!("HTTP error: {}", response.status()));
	}

	let response_text = response
		.text()
		.await
		.map_err(|e| format!("Failed to read response: {}", e))?;

	// Parse the response - it's in a special format
	// Skip the first 6 characters (")]}'\n\n")
	let json_text = if response_text.len() > 6 {
		&response_text[6..]
	} else {
		return Err("Invalid response format".to_string());
	};

	// Find the first valid JSON array line
	for line in json_text.lines() {
		if !line.starts_with('[') || line.contains("\"e\"") {
			continue;
		}

		// Parse the outer array
		let outer: serde_json::Value = serde_json::from_str(line)
			.map_err(|e| format!("Failed to parse response JSON: {}", e))?;

		// Navigate the nested structure to find the translation
		// Structure: [[["wrb.fr", "MkEWBc", "[[...translation data...]]", ...]]]
		if let Some(arr) = outer.as_array() {
			for item in arr {
				if let Some(inner_arr) = item.as_array() {
					if inner_arr.len() >= 3 {
						if let Some(wrapper_type) = inner_arr.get(0).and_then(|v| v.as_str()) {
							if wrapper_type == "wrb.fr" {
								if let Some(data_str) = inner_arr.get(2).and_then(|v| v.as_str()) {
									// Parse the inner JSON string
									let data: serde_json::Value = serde_json::from_str(data_str)
										.map_err(|e| format!("Failed to parse translation data: {}", e))?;

									// Extract translation and detected language
									// Structure: [[[null, null, null, [[[0, [[[null, "translated text"]]]...], detected_lang, ...
									if let Some(translation_data) = data.get(1).and_then(|v| v.get(0)).and_then(|v| v.get(0)).and_then(|v| v.get(5)) {
										if let Some(parts) = translation_data.as_array() {
											let mut translated_text = String::new();
											for part in parts {
												if let Some(segment) = part.get(0).and_then(|v| v.as_str()) {
													translated_text.push_str(segment);
												}
											}

											// Get detected language
											let detected_lang = data
												.get(1)
												.and_then(|v| v.get(0))
												.and_then(|v| v.get(0))
												.and_then(|v| v.get(1))
												.and_then(|v| v.as_str())
												.unwrap_or("auto")
												.to_string();

											// If detected language is English, return error to signal no translation needed
											if detected_lang == "en" {
												return Err("Source is English".to_string());
											}

											return Ok(TranslationResult {
												text: translated_text,
												detected_language: detected_lang,
											});
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}

	Err("Could not parse translation from response".to_string())
}

// Command to show a toast notification in a separate window
#[tauri::command]
async fn show_toast(app: tauri::AppHandle, message: String) -> Result<(), String> {
	let toast_label = "toast";

	// Get the spotlight window to determine which monitor to show toast on
	let spotlight_window = app.get_webview_window("spotlight");

	// Get the monitor where spotlight is displayed (or current monitor)
	let target_monitor = spotlight_window
		.as_ref()
		.and_then(|w| w.current_monitor().ok().flatten());

	// Check if toast window already exists
	if let Some(window) = app.get_webview_window(toast_label) {
		// Position the toast on the same monitor as spotlight
		if let Some(monitor) = &target_monitor {
			let monitor_pos = monitor.position();
			let monitor_size = monitor.size();
			let scale = monitor.scale_factor();
			let toast_width = 300.0 * scale;
			let x = monitor_pos.x as f64 + (monitor_size.width as f64 - toast_width) / 2.0;
			let y = monitor_pos.y as f64 + 100.0 * scale;
			let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
				x: x as i32,
				y: y as i32,
			}));
		}

		let _ = window.emit("toast://message", message.clone());
		let _ = window.show();
		let _ = window.set_focus();
	} else {
		// Create the toast window
		let toast_url = tauri::WebviewUrl::App("index.html?window=toast".into());

		let window = WebviewWindowBuilder::new(&app, toast_label, toast_url)
			.title("Toast")
			.inner_size(300.0, 50.0)
			.resizable(false)
			.decorations(false)
			.always_on_top(true)
			.transparent(true)
			.skip_taskbar(true)
			.shadow(false)
			.visible(false)
			.build()
			.map_err(|e| format!("Failed to create toast window: {}", e))?;

		// Position the toast on the same monitor as spotlight
		if let Some(monitor) = &target_monitor {
			let monitor_pos = monitor.position();
			let monitor_size = monitor.size();
			let scale = monitor.scale_factor();
			let toast_width = 300.0 * scale;
			let x = monitor_pos.x as f64 + (monitor_size.width as f64 - toast_width) / 2.0;
			let y = monitor_pos.y as f64 + 100.0 * scale;
			let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
				x: x as i32,
				y: y as i32,
			}));
		}

		// Small delay to let window initialize before emitting
		tokio::time::sleep(Duration::from_millis(100)).await;

		let _ = window.emit("toast://message", message.clone());
		let _ = window.show();
	}

	// Auto-hide after 2 seconds
	let app_clone = app.clone();
	tokio::spawn(async move {
		tokio::time::sleep(Duration::from_secs(2)).await;
		if let Some(window) = app_clone.get_webview_window(toast_label) {
			let _ = window.hide();
		}
	});

	Ok(())
}

// macOS-specific panel setup using tauri-nspanel
#[cfg(target_os = "macos")]
mod macos {
	use tauri::{AppHandle, Manager, WebviewWindow};
	use tauri_nspanel::{
		tauri_panel, CollectionBehavior, ManagerExt, PanelLevel, StyleMask, WebviewWindowExt,
	};

	// Define a panel class that can become key window and floats
	// Also define an event handler for window events
	tauri_panel! {
		panel!(SpotlightPanel {
			config: {
				can_become_key_window: true,
				is_floating_panel: true
			}
		})

		panel_event!(SpotlightPanelEventHandler {
			window_did_resign_key(notification: &NSNotification) -> ()
		})
	}

	pub fn init_panel(app_handle: &AppHandle) {
		let window: WebviewWindow = app_handle.get_webview_window("spotlight").unwrap();

		// Convert the window to a panel
		let panel = window.to_panel::<SpotlightPanel>().unwrap();

		// Set the window to floating level (appears above normal windows)
		panel.set_level(PanelLevel::Floating.value());

		// NonactivatingPanel: panel doesn't activate the app when clicked
		// This is crucial for Spotlight-like behavior
		panel.set_style_mask(StyleMask::empty().nonactivating_panel().into());

		// Collection behaviors for fullscreen support:
		// - full_screen_auxiliary: can appear alongside fullscreen apps
		// - can_join_all_spaces: appears on all spaces/desktops
		panel.set_collection_behavior(
			CollectionBehavior::new()
				.full_screen_auxiliary()
				.can_join_all_spaces()
				.into(),
		);

		// Set up event handler to hide panel when it loses focus
		let handler = SpotlightPanelEventHandler::new();
		let handle = app_handle.clone();

		handler.window_did_resign_key(move |_notification| {
			// Hide the panel when it loses key window status (clicked outside)
			if let Ok(panel) = handle.get_webview_panel("spotlight") {
				panel.hide();
			}
		});

		panel.set_event_handler(Some(handler.as_ref()));

		// Hide the panel initially
		panel.hide();
	}

	pub fn show_panel(app_handle: &AppHandle) {
		if let Ok(panel) = app_handle.get_webview_panel("spotlight") {
			panel.show_and_make_key();
		}
	}

	pub fn hide_panel(app_handle: &AppHandle) {
		if let Ok(panel) = app_handle.get_webview_panel("spotlight") {
			panel.hide();
		}
	}

	pub fn is_panel_visible(app_handle: &AppHandle) -> bool {
		app_handle
			.get_webview_panel("spotlight")
			.map(|p| p.is_visible())
			.unwrap_or(false)
	}
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	// Load .env file from the project root
	// This needs to find the .env file relative to where the app is run from
	if let Err(e) = dotenvy::dotenv() {
		eprintln!("Warning: Could not load .env file: {}", e);
	}

	let mut builder = tauri::Builder::default()
		.plugin(tauri_plugin_http::init())
		.plugin(tauri_plugin_store::Builder::new().build())
		.plugin(tauri_plugin_clipboard_manager::init())
		.plugin(
			tauri_plugin_log::Builder::new()
				.level(tauri_plugin_log::log::LevelFilter::Info)
				.build(),
		)
		.plugin(tauri_plugin_autostart::Builder::new().build())
		.plugin(tauri_plugin_opener::init());

	// Add nspanel plugin on macOS
	#[cfg(target_os = "macos")]
	{
		builder = builder.plugin(tauri_nspanel::init());
	}

	builder
		.setup(|app| {
			// Set activation policy to Accessory (no dock icon, no app switcher)
			// This is essential for Spotlight-like behavior
			app.set_activation_policy(tauri::ActivationPolicy::Accessory);

			// Create system tray with Options and Exit menu
			let options_item = MenuItem::with_id(app, "options", "Options", true, None::<&str>)?;
			let quit_item = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;
			let menu = Menu::with_items(app, &[&options_item, &quit_item])?;

			let _tray = TrayIconBuilder::new()
				.icon(app.default_window_icon().unwrap().clone())
				.menu(&menu)
				.show_menu_on_left_click(true)
				.on_menu_event(|app, event| match event.id.as_ref() {
					"options" => {
						// Check if options window already exists
						if let Some(window) = app.get_webview_window("options") {
							// If it exists, just show and focus it
							let _ = window.show();
							let _ = window.set_focus();
						} else {
							// Create the options window
							let options_url =
								tauri::WebviewUrl::App("index.html?window=options".into());
							if let Ok(window) =
								WebviewWindowBuilder::new(app, "options", options_url)
									.title("Options")
									.inner_size(450.0, 420.0)
									.resizable(false)
									.center()
									.build()
							{
								let _ = window.show();
								let _ = window.set_focus();
							}
						}
					}
					"quit" => {
						app.exit(0);
					}
					_ => {}
				})
				.build(app)?;

			#[cfg(desktop)]
			{
				use tauri_plugin_global_shortcut::{
					Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
				};

				// Initialize the panel on macOS
				#[cfg(target_os = "macos")]
				{
					macos::init_panel(app.handle());
				}

				// Option+Space on macOS, Alt+Space on Windows/Linux
				let shortcut = Shortcut::new(Some(Modifiers::ALT), Code::Space);
				let app_handle = app.handle().clone();

				app.handle().plugin(
					tauri_plugin_global_shortcut::Builder::new()
						.with_handler(move |_app, hotkey, event| {
							if hotkey == &shortcut && event.state() == ShortcutState::Pressed {
								#[cfg(target_os = "macos")]
								{
									if macos::is_panel_visible(&app_handle) {
										macos::hide_panel(&app_handle);
									} else {
										// Center the window before showing
										if let Some(window) =
											app_handle.get_webview_window("spotlight")
										{
											let _ = window.center();
										}
										macos::show_panel(&app_handle);
									}
								}

								#[cfg(not(target_os = "macos"))]
								{
									if let Some(window) = app_handle.get_webview_window("spotlight")
									{
										if window.is_visible().unwrap_or(false) {
											let _ = window.hide();
										} else {
											let _ = window.center();
											let _ = window.show();
											let _ = window.set_focus();
										}
									}
								}
							}
						})
						.build(),
				)?;

				app.global_shortcut().register(shortcut)?;
			}
			Ok(())
		})
		.invoke_handler(tauri::generate_handler![greet, list_models, chat_stream, quick_answer, show_toast, translate_text])
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
