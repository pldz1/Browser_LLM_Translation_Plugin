chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "llm_translate_contextmenu",
    title: "Using LLM translate selected content.",
    // 仅在有选中文本时显示
    contexts: ["selection"],
  });
});

// 右键开始行为
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === "llm_translate_contextmenu") {
    await translateText();
  }
});

// 快捷键行为
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "llm_translate_shortcut") {
    await translateText();
  }
});

// 执行翻译
async function translateText() {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.scripting
      .executeScript({
        target: { tabId: tab.id },
        func: getSelectedText,
      })
      .then(async (results) => {
        if (results && results[0] && results[0].result) {
          const selectedText = results[0].result;
          const targetLanguage = await fetchLLM(selectedText);

          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            args: [targetLanguage],
            func: replaceSelectedText,
          });
        }
      });
  }
}

// 获取选中的文本
function getSelectedText() {
  const activeElement = document.activeElement;
  if (
    activeElement &&
    (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")
  ) {
    return activeElement.value.substring(
      activeElement.selectionStart,
      activeElement.selectionEnd
    );
  } else {
    return window.getSelection().toString();
  }
}

// 替换选中的文本
function replaceSelectedText(targetLanguage) {
  if (!targetLanguage) return;

  const activeElement = document.activeElement;

  if (
    activeElement &&
    (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")
  ) {
    const start = activeElement.selectionStart;
    const end = activeElement.selectionEnd;
    const value = activeElement.value;

    activeElement.value =
      value.substring(0, start) + targetLanguage + value.substring(end);
    activeElement.setSelectionRange(start, start + targetLanguage.length);
  } else {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(targetLanguage));
    }
  }
}

async function fetchLLM(data) {
  try {
    const response = await fetch("https://example.com", {
      headers: {
        accept: "application/json",
        "api-key": "<YOUR API KEY>",
        "content-type": "application/json",
      },
      referrerPolicy: "strict-origin-when-cross-origin",
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `请帮我把这个: ${data} 翻译为专业的英语, 注意直接输出你翻译的结果即可, 不需要任何其他的内容!`,
              },
            ],
          },
        ],
      }),
      method: "POST",
      mode: "cors",
      credentials: "omit",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();
    return result.choices[0].message.content; // 确保返回翻译结果
  } catch (error) {
    console.error("Something bad happened:", error);
    // 遇到错误时返回 null
    return null;
  }
}
