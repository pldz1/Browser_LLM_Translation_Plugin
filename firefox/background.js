browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "llm_translate_contextmenu",
    title: "Using LLM translate selected content.",
    contexts: ["selection"],
  });
});

// 右键菜单点击
browser.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === "llm_translate_contextmenu") {
    await translateText();
  }
});

// 快捷键监听
browser.commands.onCommand.addListener(async (command) => {
  if (command === "llm_translate_shortcut") {
    await translateText();
  }
});

// 执行翻译
async function translateText() {
  let [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    try {
      // 显示加载动画
      await browser.tabs.executeScript(tab.id, {
        code: `(${showLoadingIndicator.toString()})()`,
      });

      // 获取选中的文本
      const results = await browser.tabs.executeScript(tab.id, {
        code: `(${getSelectedText.toString()})()`,
      });

      if (results && results[0]) {
        const selectedText = results[0];
        const translatedText = await fetchLLM(selectedText);
        if (!translatedText) return;

        // 获取是否需要替换原文本
        const { replaceText = false } = await getStorageData(["replaceText"]);

        // 处理翻译文本
        await browser.tabs.executeScript(tab.id, {
          code: `(${processTranslation.toString()})(${JSON.stringify(
            translatedText
          )}, ${replaceText})`,
        });
      }
    } catch (error) {
      console.error("翻译失败：", error);
    } finally {
      // 移除加载动画
      await browser.tabs.executeScript(tab.id, {
        code: `(${removeLoader.toString()})()`,
      });
    }
  }
}

// 选中区域旁边显示加载动画
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
        color: white;
        z-index: 10000;
        box-shadow: 0px 0px 5px rgba(0, 0, 0, 0.3);
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

// 处理翻译文本
function processTranslation(translation, replaceFlag) {
  if (replaceFlag) {
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
    // 移除已有翻译窗口
    const existingDiv = document.getElementById("llm_translate_div");
    if (existingDiv) {
      existingDiv.remove();
    }

    // 显示翻译结果
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

      // 设置 div 的位置
      div.style.top = rect.bottom + window.scrollY + "px";
      div.style.left = rect.left + window.scrollX + "px";

      document.body.appendChild(div);
    }
  }
}

// 获取存储数据
function getStorageData(keys) {
  return new Promise((resolve) => {
    browser.storage.local.get(keys, function (result) {
      resolve(result);
    });
  });
}

// 发送请求到 LLM 进行翻译
async function fetchLLM(data) {
  try {
    const {
      endpoint = "",
      apikey = "",
      target = "",
    } = await getStorageData(["endpoint", "apikey", "target"]);
    if (!endpoint || !apikey || !target) {
      return "关键参数没有设置完全";
    }

    const language = target === "cn" ? "中文" : "英语";
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "api-key": apikey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `请帮我把这个: ${data} 翻译为专业的${language}, 直接输出翻译结果!`,
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
    return result.choices[0].message.content || "翻译失败";
  } catch (error) {
    console.error("获取存储数据出错：", error);
    return "获取存储数据出错";
  }
}
