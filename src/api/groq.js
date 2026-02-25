import api from "./axios";
import axios from "axios";

const VISION_SEARCH_PATH =
  import.meta.env.VITE_VISION_SEARCH_PATH || "/vision/search-by-image";

const GROQ_CHAT_MODEL =
  import.meta.env.VITE_GROQ_CHAT_MODEL || "llama-3.3-70b-versatile";
const GROQ_VISION_MODEL =
  import.meta.env.VITE_GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

const sanitizeSearchQuery = (value, maxLen = 160) =>
  String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);

const normalizeWord = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const pickFirst = (...values) => {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
};

const GENERIC_VISION_LABELS = new Set([
  "product",
  "products",
  "item",
  "items",
  "object",
  "objects",
  "general",
  "unknown",
  "other",
  "misc",
]);

const normalizeLabel = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sanitizeVisionLabel = (value) => {
  const normalized = normalizeLabel(value);
  return GENERIC_VISION_LABELS.has(normalized) ? "" : String(value || "").trim();
};

const buildTokenList = (values, max = 10) => {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const token = normalizeWord(value);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= max) break;
  }
  return out;
};

const readVisionAttributes = (firstItem = {}) => {
  const attributes =
    firstItem?.attributes && typeof firstItem.attributes === "object"
      ? firstItem.attributes
      : {};

  return {
    category: pickFirst(firstItem?.category, attributes?.category),
    subtype: pickFirst(firstItem?.subtype, attributes?.subtype, attributes?.type),
    color: pickFirst(attributes?.color, attributes?.primary_color),
    gender: pickFirst(attributes?.gender, attributes?.target_gender),
    pattern: pickFirst(attributes?.pattern, attributes?.print),
    material: pickFirst(attributes?.material, attributes?.fabric),
    style: pickFirst(attributes?.style, attributes?.occasion),
    sleeve: pickFirst(attributes?.sleeve, attributes?.sleeve_type),
    neckline: pickFirst(attributes?.neckline),
    fit: pickFirst(attributes?.fit),
  };
};

const buildVisionSummary = (attrs) => {
  const details = [
    attrs.color,
    attrs.gender,
    attrs.pattern,
    attrs.material,
    attrs.subtype || attrs.category,
  ].filter(Boolean);
  if (details.length === 0) return "";
  return `Detected ${details.join(" ")}.`;
};

const safeJsonParse = (value, fallback = {}) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const validateAiConfig = () => ({
  backendVision: {
    enabled: true,
    endpoint: VISION_SEARCH_PATH,
  },
});

export const buildShoppingIntentWithGroq = async ({
  query,
  imageDataUrl,
}) => {
  const configStatus = validateAiConfig();
  const hasImage = Boolean(imageDataUrl);
  const cleanedQuery = (query || "").trim();
  const defaultQuery = hasImage ? "" : "shopping product";

  let assistantReply = "";
  let searchQuery = cleanedQuery || defaultQuery;
  let includeKeywords = [];
  let excludeKeywords = [];
  let confidence = cleanedQuery ? 0.75 : 0.6;

  let requiredType = "";
  let detectedColor = "";
  let gender = "";
  let style = "";
  let pattern = "";
  let material = "";
  let sleeve = "";
  let neckline = "";
  let fit = "";
  let category = "";
  let diagnosticsMessage = "";
  let errorCode = "";

  try {
    if (hasImage) {
      const response = await api.post(VISION_SEARCH_PATH, {
        image: imageDataUrl,
        text_hint: cleanedQuery,
        top_k: 24,
        strict_category: true,
      });

      const detectedItems = Array.isArray(response?.data?.detected_items)
        ? response.data.detected_items
        : [];

      const firstItem = detectedItems[0] || {};
      const attrs = readVisionAttributes(firstItem);

      category = sanitizeVisionLabel(attrs.category);
      requiredType = sanitizeVisionLabel(attrs.subtype) || category;
      detectedColor = attrs.color;
      gender = attrs.gender;
      style = attrs.style;
      pattern = attrs.pattern;
      material = attrs.material;
      sleeve = attrs.sleeve;
      neckline = attrs.neckline;
      fit = attrs.fit;

      const queryParts = [
        detectedColor,
        gender,
        pattern,
        material,
        requiredType,
        cleanedQuery,
      ].filter(Boolean);

      searchQuery = sanitizeSearchQuery(queryParts.join(" ") || cleanedQuery || defaultQuery);
      includeKeywords = buildTokenList([
        detectedColor,
        gender,
        requiredType,
        pattern,
        material,
        style,
        sleeve,
        neckline,
        fit,
        ...searchQuery.split(" "),
      ]);
      assistantReply = buildVisionSummary({
        ...attrs,
        category,
        subtype: requiredType,
      });
      const backendConfidence = Number(response?.data?.confidence);
      const hasSpecificSignal = Boolean(requiredType || detectedColor || pattern || material || style);
      confidence = Number.isFinite(backendConfidence)
        ? backendConfidence
        : (hasSpecificSignal ? 0.86 : 0.35);
      diagnosticsMessage = String(response?.data?.diagnostics || "").trim();
      if (!hasSpecificSignal) {
        diagnosticsMessage = [
          diagnosticsMessage,
          "Vision returned generic labels only.",
        ].filter(Boolean).join(" ");
      }
      errorCode = String(response?.data?.error_code || "").trim();
    }
  } catch (err) {
    console.error("Backend vision intent failed:", err);
    errorCode = err?.code === "ERR_NETWORK" ? "missing_server" : "vision_error";
    diagnosticsMessage =
      err?.code === "ERR_NETWORK"
        ? "Vision API is unreachable at the configured backend URL."
        : "Vision analysis failed; using query fallback.";
  }

  return {
    assistantReply,
    searchQuery,
    includeKeywords,
    excludeKeywords,
    confidence,
    meta: {
      providerUsed: "backend-vision",
      requiredType,
      detectedColor,
      gender,
      style,
      pattern,
      material,
      sleeve,
      neckline,
      fit,
      category,
      diagnosticsMessage,
      errorCode,
      confidence,
      configStatus,
    },
  };
};

export const analyzeFashionWithGroq = async (caption) => {
  try {
    if (!GROQ_API_KEY) {
      throw new Error("Missing VITE_GROQ_API_KEY");
    }

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: GROQ_CHAT_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Extract product attributes. Return only JSON: type,color,sleeve,neckline,pattern,gender,material,fit,occasion,category.",
          },
          {
            role: "user",
            content: String(caption || ""),
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const content = response?.data?.choices?.[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (err) {
    console.error("Groq fashion analysis failed:", err?.message || err);
    return {
      type: "",
      color: "",
      sleeve: "",
      neckline: "",
      pattern: "",
      gender: "",
      material: "",
      fit: "",
      occasion: "",
      category: "",
    };
  }
};

export const analyzeImageAttributesWithGroq = async ({
  imageDataUrl,
  textHint = "",
}) => {
  try {
    if (!GROQ_API_KEY || !imageDataUrl) return null;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: GROQ_VISION_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Analyze the product in the image for ecommerce search. Return only JSON with keys: type, category, color, gender, pattern, material, style, sleeve, neckline, fit, confidence, search_query, include_keywords.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `User hint: ${String(textHint || "").trim() || "none"}`,
              },
              {
                type: "image_url",
                image_url: { url: imageDataUrl },
              },
            ],
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const content = response?.data?.choices?.[0]?.message?.content || "{}";
    const parsed = safeJsonParse(content, {});
    const includeKeywords = Array.isArray(parsed?.include_keywords)
      ? parsed.include_keywords.map((v) => String(v || "").trim()).filter(Boolean).slice(0, 10)
      : [];

    return {
      type: sanitizeVisionLabel(parsed?.type),
      category: sanitizeVisionLabel(parsed?.category),
      color: String(parsed?.color || "").trim(),
      gender: String(parsed?.gender || "").trim(),
      pattern: String(parsed?.pattern || "").trim(),
      material: String(parsed?.material || "").trim(),
      style: String(parsed?.style || "").trim(),
      sleeve: String(parsed?.sleeve || "").trim(),
      neckline: String(parsed?.neckline || "").trim(),
      fit: String(parsed?.fit || "").trim(),
      confidence: Number(parsed?.confidence) || 0,
      searchQuery: sanitizeSearchQuery(parsed?.search_query || ""),
      includeKeywords,
      provider: "groq-vision-fallback",
    };
  } catch (err) {
    console.error("Groq vision fallback failed:", err?.message || err);
    return null;
  }
};
