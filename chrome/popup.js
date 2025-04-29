document.addEventListener("DOMContentLoaded", function () {
  // 尝试获取所有需要的 DOM 元素
  const endpointInput = document.getElementById("endpoint-input");
  const apikeyInput = document.getElementById("apikey-input");
  const modelNameInput = document.getElementById("modelname-input");
  const targetSelect = document.getElementById("target-language-select");
  const translateButton = document.getElementById("start-translate");
  const translateTextarea = document.getElementById("translate-textarea");
  const translateReplace = document.getElementById("replace-text-checkbox");
  const resultSpan = document.getElementById("res-span");

  // 检查是否所有关键元素都存在
  if (
    !endpointInput ||
    !apikeyInput ||
    !modelNameInput ||
    !targetSelect ||
    !translateButton ||
    !translateTextarea ||
    !translateReplace ||
    !resultSpan
  ) {
    console.error("部分必要的 DOM 元素不存在，请检查 popup.html 文件的结构。");
    // 终止后续执行，避免 null 引起错误
    return;
  }

  // 从 chrome 存储中读取保存的数据，并填充到对应输入框
  chrome.storage.local.get(
    ["endpoint", "apikey", "target", "modelName", "replaceText"],
    function (result) {
      if (result.endpoint) {
        endpointInput.value = result.endpoint;
      }
      if (result.apikey) {
        apikeyInput.value = result.apikey;
      }
      if (result.modelName) {
        modelNameInput.value = result.modelName;
      }
      if (result.target) {
        targetSelect.value = result.target;
      }
      if (result.replaceText) {
        translateReplace.checked = result.replaceText;
      }
    }
  );

  // 当 endpoint 输入框内容发生变化时，自动保存到 chrome 存储
  endpointInput.addEventListener("change", function () {
    const endpoint = endpointInput.value;
    chrome.storage.local.set({ endpoint: endpoint }, function () {
      console.log("Endpoint 更新成功: ", endpoint);
    });
  });

  // 当 API Key 输入框内容发生变化时，自动保存到 chrome 存储
  apikeyInput.addEventListener("change", function () {
    const apikey = apikeyInput.value;
    chrome.storage.local.set({ apikey: apikey }, function () {
      console.log("API Key 更新成功: ", apikey);
    });
  });

  // 当 模型名字的 输入框内容发生变化时，自动保存到 chrome 存储
  modelNameInput.addEventListener("change", function () {
    const modelName = modelNameInput.value;
    chrome.storage.local.set({ modelName: modelName }, function () {
      console.log("modelName 更新成功: ", modelName);
    });
  });

  // 语言有变化时
  targetSelect.addEventListener("change", function () {
    const target = targetSelect.value;
    chrome.storage.local.set({ target: target }, function () {
      console.log("目标语言更新成功: ", target);
    });
  });

  // 替换操作有变化
  translateReplace.addEventListener("change", function () {
    const replaceText = translateReplace.checked;
    chrome.storage.local.set({ replaceText: replaceText }, function () {
      console.log("替换文本操作 更新成功: ", replaceText);
    });
  });

  // 点击翻译按钮时执行
  translateButton.addEventListener("click", async function () {
    translateButton.textContent = "...";
    //将返回结果展示到页面上
    const data = translateTextarea.value;
    const result = await fetchLLM(data);
    resultSpan.textContent = result;
    translateButton.textContent = "翻译";
  });
});

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

function getUserContent(target, data) {
  if (target == "editing_assistant")
    return `你是一个专业的中文和英语的润色助手, 请帮我把这个: '''${data}''' 的主体的内容, 润色成专业的官方文档和手册的表达, 注意直接输出你润色的结果即可, 不需要任何其他的内容!`;
  else
    return `你是一个专业的中文和英语互相翻译的翻译助手, 请帮我把这个: '''${data}''' 的主体的内容, 翻译为另外一种语言, 注意直接输出你翻译的结果即可, 不需要任何其他的内容!`;
}

async function fetchLLM(data) {
  try {
    // 等待数据获取完成
    const {
      endpoint = "",
      apikey = "",
      target = "",
      modelName = "",
    } = await getStorageData(["endpoint", "apikey", "target", "modelName"]);
    if (!endpoint || !apikey || !target) {
      return "关键参数没有设置完全";
    } else {
      const contentText = getUserContent(target, data);
      const response = await fetch(`${endpoint}`, {
        headers: {
          accept: "application/json",
          "api-key": `${apikey}`,
          "content-type": "application/json",
          authorization: `Bearer ${apikey}`,
        },
        referrerPolicy: "strict-origin-when-cross-origin",
        body: JSON.stringify({
          ...(modelName && { model: modelName }),
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: contentText,
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
    return "获取存储数据出错" + String(error);
  }
}
