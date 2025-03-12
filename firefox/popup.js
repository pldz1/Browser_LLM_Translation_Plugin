document.addEventListener("DOMContentLoaded", function () {
  const endpointInput = document.getElementById("endpoint-input");
  const apikeyInput = document.getElementById("apikey-input");
  const targetSelect = document.getElementById("target-language-select");
  const translateButton = document.getElementById("start-translate");
  const translateTextarea = document.getElementById("translate-textarea");
  const translateReplace = document.getElementById("replace-text-checkbox");
  const resultSpan = document.getElementById("res-span");

  browser.storage.local.get(
    ["endpoint", "apikey", "target", "replaceText"],
    function (result) {
      endpointInput.value = result.endpoint || "";
      apikeyInput.value = result.apikey || "";
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
  } = await getStorageData(["endpoint", "apikey", "target"]);
  if (!endpoint || !apikey || !target) return "缺少参数";

  const response = await fetch(endpoint, {
    method: "POST",
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
              text: `请翻译: ${data} 为${target === "cn" ? "中文" : "英语"}`,
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
