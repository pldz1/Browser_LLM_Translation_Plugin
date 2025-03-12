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

// 将 chrome.storage.local.get 封装为返回 Promise 的函数
function getStorageData(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, function (result) {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(result);
    });
  });
}

async function fetchLLM(data) {
  try {
    // 等待数据获取完成
    const {
      endpoint = "",
      apikey = "",
      target = "",
    } = await getStorageData(["endpoint", "apikey", "target"]);
    if (!endpoint || !apikey || !target) {
      return "关键参数没有设置完全";
    } else {
      const language = target == "cn" ? "中文" : "英语";
      const response = await fetch(`${endpoint}`, {
        headers: {
          accept: "application/json",
          "api-key": `${apikey}`,
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
                  text: `请帮我把这个: ${data} 翻译为专业的${language}, 注意直接输出你翻译的结果即可, 不需要任何其他的内容!`,
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
      // 确保返回翻译结果
      return result.choices[0].message.content;
    }
  } catch (error) {
    console.error("获取存储数据出错：", error);
    return null;
  }
}
