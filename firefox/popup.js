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

  browser.storage.local.get(
    ["endpoint", "apikey", "target", "modelName", "replaceText"],
    function (result) {
      endpointInput.value = result.endpoint || "";
      apikeyInput.value = result.apikey || "";
      modelNameInput.value = result.modelName || "";
      targetSelect.value = result.target || "";
      translateReplace.checked = result.replaceText || false;
    }
  );

  endpointInput.addEventListener("change", function () {
    browser.storage.local.set({ endpoint: endpointInput.value });
  });

  apikeyInput.addEventListener("change", function () {
    browser.storage.local.set({ apikey: apikeyInput.value });
  });

  modelNameInput.addEventListener("change", function () {
    browser.storage.local.set({ modelName: modelNameInput.value });
  });

  targetSelect.addEventListener("change", function () {
    browser.storage.local.set({ target: targetSelect.value });
  });

  translateReplace.addEventListener("change", function () {
    browser.storage.local.set({ replaceText: translateReplace.checked });
  });

  translateButton.addEventListener("click", async function () {
    translateButton.textContent = "...";
    const data = translateTextarea.value;
    const result = await fetchLLM(data);
    resultSpan.textContent = result;
    translateButton.textContent = "翻译";
  });
});

async function fetchLLM(data) {
  const {
    endpoint = "",
    apikey = "",
    target = "",
    modelName = "",
  } = await getStorageData(["endpoint", "apikey", "target", "modelName"]);
  if (!endpoint || !apikey || !target) return "缺少参数";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "api-key": apikey,
      "Content-Type": "application/json",
      authorization: `Bearer ${apikey}`,
    },
    body: JSON.stringify({
      ...(modelName && { model: modelName }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `你是一个专业的${target}翻译助手, 请帮我把这个: '''${data}''' 翻译为另外一种语言, 注意直接输出你翻译的结果即可, 不需要任何其他的内容!`,
            },
          ],
        },
      ],
    }),
  });

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "翻译失败";
}

function getStorageData(keys) {
  return new Promise((resolve) => {
    browser.storage.local.get(keys, function (result) {
      resolve(result);
    });
  });
}
