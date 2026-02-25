import api from "./axios";

const VISION_SEARCH_PATH = import.meta.env.VITE_VISION_SEARCH_PATH || "/vision/search-by-image";

const normalizeMatchProduct = (entry) => {
  if (!entry || typeof entry !== "object") return null;
  return entry.product && typeof entry.product === "object" ? entry.product : entry;
};

const normalizeDetectedItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      category: String(item?.category || "").trim(),
      subtype: String(item?.subtype || "").trim(),
      attributes: item?.attributes && typeof item.attributes === "object" ? item.attributes : {},
      matches: Array.isArray(item?.matches)
        ? item.matches.map(normalizeMatchProduct).filter(Boolean)
        : [],
    }))
    .filter((item) => item.matches.length > 0 || item.category || item.subtype);
};

const flattenProductsFromDetectedItems = (detectedItems) => {
  const products = [];
  const seen = new Set();

  for (const item of detectedItems) {
    for (const product of item.matches) {
      const key = String(product?.id || product?._id || `${product?.title || ""}|${product?.platform || ""}|${product?.url || ""}`).trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      products.push(product);
    }
  }

  return products;
};

export const searchByImageVision = async ({
  imageDataUrl,
  textHint = "",
  topK = 24,
  strictCategory = true,
}) => {

  if (!imageDataUrl) return null;

  try {

    const { data } = await api.post(
      VISION_SEARCH_PATH,
      {
        image: imageDataUrl,              // ✅ REQUIRED NAME
        text_hint: textHint,              // ✅ REQUIRED NAME
        top_k: topK,                      // ✅ REQUIRED NAME
        strict_category: Boolean(strictCategory), // ✅ REQUIRED NAME
      }
    );

    const detectedItems = normalizeDetectedItems(data?.detected_items);

    const productsFromItems =
      flattenProductsFromDetectedItems(detectedItems);

    const directResults =
      Array.isArray(data?.results)
        ? data.results
        : [];

    const products =
      productsFromItems.length > 0
        ? productsFromItems
        : directResults;

    return {
      detectedItems,
      products,
      meta: {
        provider: String(data?.provider || "vision_search").trim(),
        endpoint: VISION_SEARCH_PATH,
      },
    };

  }
  catch (err) {

    const status = err?.response?.status;

    if (status === 404 || status === 501)
      return null;

    throw err;

  }

};