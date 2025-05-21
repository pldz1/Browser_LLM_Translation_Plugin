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
