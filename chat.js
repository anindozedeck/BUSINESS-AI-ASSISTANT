const form = document.querySelector("#chat-form");
const input = document.querySelector("#question");
const messages = document.querySelector("#messages");
const sendButton = document.querySelector("#send-button");
const characterCount = document.querySelector("#character-count");
const serviceStatus = document.querySelector("#service-status");
const statusLabel = document.querySelector("#status-label");
let busy = false;

function setStatus(label, state) {
  statusLabel.textContent = label;
  serviceStatus.classList.remove("is-ready", "is-warning", "is-offline");
  if (state) serviceStatus.classList.add(state);
}

function addMessage(role, text, sources = [], error = false) {
  const article = document.createElement("article");
  article.className = `message ${role === "user" ? "user-message" : "assistant-message"}${error ? " error-message" : ""}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "user" ? "Y" : "G";

  const content = document.createElement("div");
  content.className = "message-content";
  const meta = document.createElement("div");
  meta.className = "message-meta";
  const name = document.createElement("strong");
  name.textContent = role === "user" ? "You" : "Goodday Assistant";
  const time = document.createElement("time");
  time.dateTime = new Date().toISOString();
  time.textContent = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
  meta.append(name, time);

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  bubble.append(paragraph);
  content.append(meta, bubble);

  if (sources.length) {
    const sourceList = document.createElement("div");
    sourceList.className = "source-list";
    sourceList.setAttribute("aria-label", "Answer sources");
    for (const source of sources) {
      const chip = document.createElement("span");
      chip.className = "source-chip";
      chip.textContent = source;
      sourceList.append(chip);
    }
    content.append(sourceList);
  }

  if (role === "user") article.append(content, avatar);
  else article.append(avatar, content);
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
  return article;
}

function showTyping() {
  const article = document.createElement("article");
  article.className = "message assistant-message";
  article.setAttribute("aria-label", "Assistant is thinking");
  article.innerHTML = '<div class="message-avatar" aria-hidden="true">G</div><div class="message-content"><div class="bubble"><span class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></span></div></div>';
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
  return article;
}

function setBusy(value) {
  busy = value;
  sendButton.disabled = value;
  sendButton.querySelector("span").textContent = value ? "Sending" : "Send";
  input.disabled = value;
  for (const suggestion of document.querySelectorAll(".suggestion")) {
    suggestion.disabled = value;
  }
}

async function checkService() {
  try {
    const response = await fetch("/health", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Health check failed");
    const result = await response.json();
    setStatus(
      result.ai_configured ? "Assistant ready" : "API key needed",
      result.ai_configured ? "is-ready" : "is-warning",
    );
  } catch {
    setStatus("Service unavailable", "is-offline");
  }
}

async function sendQuestion(question) {
  if (busy || !question.trim()) return;
  const text = question.trim();
  addMessage("user", text);
  input.value = "";
  updateCharacterCount();
  setBusy(true);
  const typing = showTyping();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ question: text }),
    });
    const result = await response.json();
    typing.remove();
    if (!response.ok) {
      addMessage("assistant", result.error || "I couldn't complete that request. Please try again.", [], true);
      if (response.status >= 500) setStatus("Needs attention", "is-warning");
      return;
    }
    addMessage("assistant", result.answer, result.sources || []);
  } catch {
    typing.remove();
    addMessage("assistant", "I couldn't reach the assistant. Check your connection and try again.", [], true);
    setStatus("Service unavailable", "is-offline");
  } finally {
    setBusy(false);
    input.focus();
  }
}

function updateCharacterCount() {
  characterCount.textContent = `${input.value.length} / 2000`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendQuestion(input.value);
});

input.addEventListener("input", updateCharacterCount);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

for (const suggestion of document.querySelectorAll(".suggestion")) {
  suggestion.addEventListener("click", () => sendQuestion(suggestion.dataset.question || ""));
}

checkService();
