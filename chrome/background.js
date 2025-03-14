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
    try {
      // 显示加载动画
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: showLoadingIndicator,
      });

      // 获取选中的文本
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getSelectedText,
      });

      if (results && results[0] && results[0].result) {
        const selectedText = results[0].result;
        const translatedText = await fetchLLM(selectedText);
        if (!translatedText) return;
        // 从 storage 中读取 replace 的值，默认 false
        const { replaceText = false } = await getStorageData(["replaceText"]);
        // 根据 replace 值调用不同的显示逻辑
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [translatedText, replaceText],
          func: processTranslation,
        });
      }
    } catch (error) {
      console.error("翻译过程中出现错误：", error);
    } finally {
      // 无论成功与否，都移除 loader
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: removeLoader,
      });
    }
  }
}

// 在选中区域旁边显示加载动画
function showLoadingIndicator() {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const loader = document.createElement("div");
    loader.id = "llm_translate_loader";
    loader.innerHTML = "🔄";
    loader.style.cssText = `
      position: absolute;
      top: ${rect.bottom + window.scrollY + 5}px;
      left: ${rect.left + window.scrollX}px;
      background: #0b57d0;
      padding: 5px 10px;
      border-radius: 5px;
      font-size: 12px;
      font-weight: bold;
      color: black;
      z-index: 10000;
      box-shadow: 0px 0px 5px rgba(0, 0, 0, 0.3);
      transition: opacity 0.3s ease-out;
    `;
    document.body.appendChild(loader);
    return selection.toString();
  }
  return null;
}

// 移除加载动画
function removeLoader() {
  const loader = document.getElementById("llm_translate_loader");
  if (loader) {
    loader.remove();
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

// 在页面中处理翻译后的显示：替换文本或显示悬浮 div
function processTranslation(translation, replaceFlag) {
  if (replaceFlag) {
    // 替换选中的文本
    if (!translation) return;

    const activeElement = document.activeElement;

    if (
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA")
    ) {
      activeElement.focus();
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      const value = activeElement.value;

      activeElement.value =
        value.substring(0, start) + translation + value.substring(end);
      activeElement.setSelectionRange(start, start + translation.length);
    } else {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(translation));
      }
    }
  } else {
    // 如果已有悬浮 div 存在，先移除
    const existingDiv = document.getElementById("llm_translate_div");
    if (existingDiv) {
      existingDiv.remove();
    }
    // 在选中的文本下方显示一个悬浮 div
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const div = document.createElement("div");
      div.id = "llm_translate_div";
      div.textContent = translation;

      // 添加关闭按钮
      const closeButton = document.createElement("button");
      closeButton.textContent = "X";
      closeButton.style.cssText = `
          position: absolute;
          top: 0;
          right: 0;
          cursor: pointer;
          border: none;
          background: transparent;
          font-size: 12px;
          font-weight: bold;
      `;
      closeButton.addEventListener("click", () => {
        div.remove();
      });

      div.style.cssText = `
          position: absolute;
          background-color: yellow;
          border: 1px solid black;
          padding: 20px 5px 5px 5px;
          box-sizing: border-box;
          max-width: 400px;
      `;
      div.appendChild(closeButton);

      // 设置 div 的位置：位于选中区域下方
      div.style.top = rect.bottom + window.scrollY + "px";
      div.style.left = rect.left + window.scrollX + "px";

      document.body.appendChild(div);
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
    // 从 storage 中读取接口、apikey 和目标语言
    const {
      endpoint = "",
      apikey = "",
      target = "",
    } = await getStorageData(["endpoint", "apikey", "target"]);
    if (!endpoint || !apikey || !target) {
      return "关键参数没有设置完全";
    } else {
      const language = target === "cn" ? "中文" : "英语";
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
