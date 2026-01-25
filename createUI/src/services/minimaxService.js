// MiniMax API Service for Image Analysis
// Uses MiniMax Vision API (OpenAI-compatible format)

const MINIMAX_API_URL = 'https://api.minimax.chat/v1/chat/completions';

// System prompt for UI analysis
const SYSTEM_PROMPT = `你是一位资深游戏UI架构师和设计分析专家。你的任务是分析游戏界面截图，识别并提取所有UI元素的详细信息。

请分析图片并返回一个JSON格式的UI元素列表。每个元素应包含：
1. type: Unity UI Toolkit支持的类型 (VisualElement, Button, Label, Image, ProgressBar, ScrollView, TextField, Slider, Toggle)
2. name: 元素的描述性名称（英文，使用驼峰命名）
3. x, y: 元素左上角相对于画布的位置（像素）
4. width, height: 元素尺寸（像素）
5. text: 如果是按钮或标签，包含显示的文本
6. styles: 样式对象，包含：
   - backgroundColor: 背景色 (rgba格式或transparent)
   - borderColor: 边框颜色
   - borderWidth: 边框宽度
   - borderRadius: 圆角半径
   - color: 文字颜色
   - fontSize: 字体大小
7. children: 子元素数组（如果有）

重要提示：
- 仔细分析图片中的每个可见UI元素
- 准确估计每个元素的位置和尺寸
- 识别元素的层级关系，将子元素放在父元素的children数组中
- 对于复杂的UI组件（如卡片、面板），创建VisualElement作为容器
- 尽量还原原始设计的颜色和样式

只返回JSON数组，不要有其他内容。`;

// Parse AI response to extract JSON
const parseAIResponse = (content) => {
    // Try to extract JSON from the response
    let jsonStr = content;

    // Remove markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1];
    }

    // Try to find JSON array in the content
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        jsonStr = arrayMatch[0];
    }

    try {
        const parsed = JSON.parse(jsonStr);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
        console.error('Failed to parse AI response:', e);
        throw new Error('无法解析AI返回的数据，请重试');
    }
};

// Process elements and assign IDs
const processElements = (elements, parentId = null) => {
    return elements.map((el, index) => {
        const id = `element_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;

        const processed = {
            id,
            type: el.type || 'VisualElement',
            name: el.name || `element_${index}`,
            x: el.x || 0,
            y: el.y || 0,
            width: el.width || 100,
            height: el.height || 40,
            text: el.text || '',
            styles: {
                backgroundColor: el.styles?.backgroundColor || 'transparent',
                borderColor: el.styles?.borderColor || 'transparent',
                borderWidth: el.styles?.borderWidth || 0,
                borderRadius: el.styles?.borderRadius || 0,
                color: el.styles?.color || '#ffffff',
                fontSize: el.styles?.fontSize || 14,
                paddingTop: el.styles?.paddingTop || 0,
                paddingRight: el.styles?.paddingRight || 0,
                paddingBottom: el.styles?.paddingBottom || 0,
                paddingLeft: el.styles?.paddingLeft || 0,
                marginTop: el.styles?.marginTop || 0,
                marginRight: el.styles?.marginRight || 0,
                marginBottom: el.styles?.marginBottom || 0,
                marginLeft: el.styles?.marginLeft || 0,
                opacity: el.styles?.opacity ?? 1,
                flexGrow: el.styles?.flexGrow || 0,
                flexShrink: el.styles?.flexShrink || 1,
                alignItems: el.styles?.alignItems || 'auto',
                justifyContent: el.styles?.justifyContent || 'flex-start',
                flexDirection: el.styles?.flexDirection || 'column',
            },
            parentId,
            children: [],
        };

        // Recursively process children
        if (el.children && Array.isArray(el.children) && el.children.length > 0) {
            processed.children = processElements(el.children, id);
        }

        return processed;
    });
};

// Flatten nested elements for the store
const flattenElements = (elements, result = []) => {
    for (const el of elements) {
        const { children, ...elementWithoutChildren } = el;
        result.push({
            ...elementWithoutChildren,
            children: children.map(c => c.id),
        });
        if (children && children.length > 0) {
            flattenElements(children, result);
        }
    }
    return result;
};

/**
 * Analyze a game UI image using MiniMax Vision API
 * @param {string} imageBase64 - Base64 encoded image (with or without data URI prefix)
 * @param {string} apiKey - MiniMax API key
 * @returns {Promise<Array>} - Array of UI elements
 */
export const analyzeGameUI = async (imageBase64, apiKey) => {
    if (!apiKey) {
        throw new Error('请输入MiniMax API Key');
    }

    if (!imageBase64) {
        throw new Error('请先上传参考图片');
    }

    // Ensure proper data URI format
    let imageUrl = imageBase64;
    if (!imageBase64.startsWith('data:')) {
        imageUrl = `data:image/png;base64,${imageBase64}`;
    }

    const requestBody = {
        model: 'abab6.5s-chat',
        messages: [
            {
                role: 'system',
                content: SYSTEM_PROMPT,
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: {
                            url: imageUrl,
                        },
                    },
                    {
                        type: 'text',
                        text: '请分析这张游戏界面截图，识别所有UI元素并返回JSON格式的结构化数据。',
                    },
                ],
            },
        ],
        max_tokens: 4096,
        temperature: 0.1,
    };

    try {
        const response = await fetch(MINIMAX_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.error?.message ||
                `API请求失败: ${response.status} ${response.statusText}`
            );
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('API返回格式异常');
        }

        const content = data.choices[0].message.content;
        const rawElements = parseAIResponse(content);
        const processedElements = processElements(rawElements);
        const flatElements = flattenElements(processedElements);

        return flatElements;
    } catch (error) {
        console.error('MiniMax API Error:', error);
        throw error;
    }
};

export default { analyzeGameUI };
