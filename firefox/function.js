// 获取存储数据
function getStorageData(keys) {
  return new Promise((resolve) => {
    browser.storage.local.get(keys, function (result) {
      resolve(result);
    });
  });
}

// 生成具体提问的内容
function getUserContent(target, data) {
  if (target == "editing_assistant")
    return `请帮我把这个: '''${data}''', 修改成专业的官方文档和手册的中文或者英语的表达, 注意直接输出你的结果即可, 不需要任何其他的内容!`;
  else
    return `你是一个专业的中文和英语互相翻译的翻译助手, 请帮我把这个: '''${data}''', 翻译为另外一种语言, 注意直接输出你翻译的结果即可, 不需要任何其他的内容!`;
}

// 发送请求到 LLM 进行翻译
async function fetchLLM(data) {
  try {
    const {
      endpoint = "",
      apikey = "",
      target = "",
      modelName = "",
    } = await getStorageData(["endpoint", "apikey", "target", "modelName"]);
    if (!endpoint || !apikey || !target) {
      return "关键参数没有设置完全";
    }
    const contentText = getUserContent(target, data);
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "api-key": `${apikey}`,
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
    return result.choices[0].message.content || "翻译失败";
  } catch (error) {
    console.error("获取存储数据出错：", error);
    return "获取存储数据出错";
  }
}
