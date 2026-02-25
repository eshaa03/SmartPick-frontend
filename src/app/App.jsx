import { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, Heart, Pin, Plus, PanelLeftClose, PanelLeftOpen, MessageSquare, Trash2, Search } from 'lucide-react';

import { HeroSection } from './components/hero-section';
import { MultiModalInputDock } from './components/multimodal-input-dock';
import { AIChatInterface } from './components/ai-chat-interface';
import { ProductCard } from './components/product-card';
import { SavedProducts } from './components/saved-products';
import { DiscoveryFeed } from './components/discovery-feed';
import { AnalyticsDashboard } from './components/analytics-dashboard';
import { ComparisonView } from './components/comparison-view';
import { MobileNav } from './components/mobile-nav';
import { UserProfile } from './components/user-profile';
import { LoginPage } from './components/auth/login-page';
import { RegisterPage } from './components/auth/register-page';
import { AdminDashboard } from './components/admin/admin-dashboard';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { getRecommendations } from "../api/recommendations";
import { searchByImageVision } from "../api/vision";
import { analyzeImageAttributesWithGroq, buildShoppingIntentWithGroq, validateAiConfig } from "../api/groq";
import { readPreferences, subscribePreferences } from './lib/user-preferences';
import { getUserScopeId, scopedStorageKey } from './lib/user-storage';


const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const productSearchText = (product) =>
  normalizeText([
    product?.title,
    product?.category,
    product?.platform,
    product?.aiReason,
    ...(Array.isArray(product?.features) ? product.features : []),
  ].join(" "));

const toNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toPercent = (value) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
};

const pickFirstNonEmpty = (...values) => {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
};

const pickFirstMediaValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = pickFirstMediaValue(item);
      if (resolved) return resolved;
    }
    return "";
  }
  if (typeof value === "object") {
    return pickFirstNonEmpty(
      value.url,
      value.src,
      value.href,
      value.link,
      value.image,
      value.image_url,
      value.imageUrl,
      value.thumbnail
    );
  }
  return "";
};

const resolveProductImage = (source = {}) =>
  pickFirstNonEmpty(
    source.image,
    source.product_photo,
    source.productPhoto,
    source.image_url,
    source.imageUrl,
    source.imageURL,
    source.thumbnail_url,
    source.thumbnailUrl,
    source.thumbnail,
    source.product_thumbnail,
    source.productThumbnail,
    source.thumb,
    source.main_image,
    source.mainImage,
    source.primary_image,
    source.primaryImage,
    source.image_link,
    source.imageLink,
    source.img,
    pickFirstMediaValue(source.images),
    pickFirstMediaValue(source.image_urls),
    pickFirstMediaValue(source.imageUrls),
    pickFirstMediaValue(source.gallery),
    pickFirstMediaValue(source.photos),
    pickFirstMediaValue(source.media)
  );

const resolveProductUrl = (source = {}) =>
  pickFirstNonEmpty(
    source.url,
    source.link,
    source.product_link,
    source.productLink,
    source.product_url,
    source.productUrl,
    source.deep_link,
    source.deepLink,
    source.affiliate_url,
    source.affiliateUrl,
    source.permalink,
    source.web_url,
    source.webUrl,
    source.landing_page,
    source.landingPage,
    source.buy_url,
    source.buyUrl,
    source.offer_page_url,
    source.offerPageUrl,
    source.redirect_url,
    source.redirectUrl,
    source?.urls?.product,
    source?.urls?.web,
    source?.urls?.buy
  );

const readFirstPositiveNumber = (source, keys = []) => {
  for (const key of keys) {
    const value = toNumber(source?.[key]);
    if (value > 0) return value;
  }
  return 0;
};

const readAllPositiveNumbers = (source, keys = []) =>
  keys
    .map((key) => toNumber(source?.[key]))
    .filter((value) => value > 0);

const extractPricing = (source) => {
  const currentKeys = [
    "price",
    "product_price",
    "productPrice",
    "extracted_price",
    "extractedPrice",
    "current_price",
    "currentPrice",
    "sale_price",
    "salePrice",
    "offer_price",
    "offerPrice",
    "final_price",
    "finalPrice",
    "discounted_price",
    "discountedPrice",
    "deal_price",
    "dealPrice",
    "special_price",
    "specialPrice",
  ];
  const mrpKeys = [
    "originalPrice",
    "original_price",
    "old_price",
    "oldPrice",
    "product_old_price",
    "productOldPrice",
    "mrp",
    "m_r_p",
    "marked_price",
    "markedPrice",
    "max_price",
    "maxPrice",
    "price_mrp",
    "priceMrp",
    "price_before_discount",
    "priceBeforeDiscount",
    "regular_price",
    "regularPrice",
    "list_price",
    "listPrice",
    "strike_price",
    "strikePrice",
    "cross_price",
    "crossPrice",
    "was_price",
    "wasPrice",
    "compare_at_price",
    "compareAtPrice",
  ];

  let currentPrice = readFirstPositiveNumber(source, currentKeys);
  let mrp = readFirstPositiveNumber(source, mrpKeys);

  const allPrices = Array.from(new Set([
    ...readAllPositiveNumbers(source, currentKeys),
    ...readAllPositiveNumbers(source, mrpKeys),
  ])).sort((a, b) => a - b);

  if (!currentPrice && allPrices.length > 0) {
    currentPrice = allPrices[0];
  }
  if (!mrp && allPrices.length > 1) {
    mrp = allPrices[allPrices.length - 1];
  }
  if (currentPrice > 0 && mrp > 0 && mrp < currentPrice) {
    const min = Math.min(currentPrice, mrp);
    const max = Math.max(currentPrice, mrp);
    currentPrice = min;
    mrp = max;
  }
  if (mrp <= 0) {
    mrp = 0;
  }

  return { currentPrice, mrp };
};

const isGenericAiReason = (value) => {
  const text = normalizeText(value);
  if (!text) return true;
  return (
    text.includes("popular product") ||
    text.includes("matching your search") ||
    text === "fallback result"
  );
};

const buildDynamicAiReason = (product) => {
  const title = String(product?.title || "this product").trim();
  const price = toNumber(product?.price);
  const rating = Number(product?.rating) || 0;
  const platform = String(product?.platform || "online store").trim();

  if (rating >= 4.3 && price > 0) {
    return `${title} is a strong pick on ${platform} with high rating and competitive pricing.`;
  }
  if (rating >= 4.0) {
    return `${title} stands out on ${platform} due to consistently good customer ratings.`;
  }
  if (price > 0) {
    return `${title} is a relevant option on ${platform} in this price range.`;
  }
  return `${title} is a relevant match on ${platform} for your request.`;
};

const buildDynamicFeatures = (product) => {
  const features = [];
  const rating = Number(product?.rating) || 0;
  const reviews = toNumber(product?.reviews);
  const hasOffer =
    toNumber(product?.originalPrice) > 0 &&
    toNumber(product?.price) > 0 &&
    toNumber(product?.originalPrice) > toNumber(product?.price);
  const platform = String(product?.platform || "").trim();

  if (rating >= 4.0) features.push(`Rated ${rating.toFixed(1)} by customers`);
  if (reviews > 0) features.push(`${reviews.toLocaleString()} customer reviews`);
  if (hasOffer) features.push("Discounted compared to original price");
  if (platform) features.push(`Available on ${platform}`);

  return features.slice(0, 3);
};

const normalizeProductForDisplay = (product) => {
  const source = product?.product && typeof product.product === "object"
    ? product.product
    : product || {};

  const title = pickFirstNonEmpty(
    source.title,
    source.product_title,
    source.productTitle,
    source.name,
    source.product_name,
    source.productName,
    source.display_name,
    source.displayName,
    source.item_name,
    source.itemName,
    "Product"
  );
  const { currentPrice, mrp } = extractPricing(source);
  const price = currentPrice;
  let normalizedOriginalPrice = mrp;
  const explicitDiscountPercent = toPercent(
    source.discountPercent ??
    source.discount_percent ??
    source.discountPercentage ??
    source.offer_percent ??
    source.off_percent
  );
  if (!normalizedOriginalPrice && price > 0 && explicitDiscountPercent > 0 && explicitDiscountPercent < 100) {
    const derivedMrp = Math.round((price * 100) / (100 - explicitDiscountPercent));
    if (derivedMrp > price) {
      normalizedOriginalPrice = derivedMrp;
    }
  }
  const inferredDiscountPercent =
    normalizedOriginalPrice > 0 && price > 0
      ? Math.round(((normalizedOriginalPrice - price) / normalizedOriginalPrice) * 100)
      : 0;
  const normalizedDiscountPercent = explicitDiscountPercent || inferredDiscountPercent;
  const normalizedHasOffer =
    Boolean(source.hasOffer || source.has_offer || source.onSale || source.on_sale) ||
    normalizedDiscountPercent > 0 ||
    (normalizedOriginalPrice > price && price > 0);

  const rating = Number(
    source.rating ??
      source.stars ??
      source.review_rating ??
      source.average_rating ??
      source.product_rating ??
      source.productRating
  );
  const normalizedRating = Number.isFinite(rating) && rating > 0
    ? Math.min(5, Math.max(0, rating))
    : 0;

  const reviews = toNumber(
    source.reviews ??
      source.review_count ??
      source.ratings_total ??
      source.rating_count ??
      source.reviews_count ??
      source.reviewsCount ??
      source.total_reviews ??
      source.totalReviews
  );

  const platform = pickFirstNonEmpty(
    source.platform,
    source.source,
    source.source_name,
    source.sourceName,
    source.store,
    source.marketplace,
    source.vendor,
    source.seller,
    "SmartPick"
  );
  const url = resolveProductUrl(source);
  const image = resolveProductImage(source);
  const aiReason = isGenericAiReason(source.aiReason || source.reason || source.explanation)
    ? buildDynamicAiReason({
        ...source,
        title,
        price,
        rating: normalizedRating,
        platform,
      })
    : String(source.aiReason || source.reason || source.explanation || "").trim();

  const originalFeatures = Array.isArray(source.features)
    ? source.features.map((v) => String(v || "").trim()).filter(Boolean)
    : [];
  const features = originalFeatures.length > 0
    ? originalFeatures
    : buildDynamicFeatures({
        ...source,
        price,
        originalPrice: normalizedOriginalPrice,
        rating: normalizedRating,
        reviews,
        platform,
      });

  return {
    ...source,
    title,
    price,
    originalPrice: normalizedOriginalPrice,
    hasOffer: normalizedHasOffer,
    discountPercent: normalizedDiscountPercent,
    rating: normalizedRating,
    reviews,
    platform,
    url,
    image,
    aiReason,
    features,
    currencySymbol:
      source.currencySymbol ||
      source.currency_symbol ||
      source.currency ||
      "INR",
  };
};

const TYPE_GROUPS = {
  bag: ["bag", "handbag", "tote", "sling", "backpack", "purse", "clutch", "satchel", "wallet"],
  shoes: ["shoe", "shoes", "sneaker", "sneakers", "footwear", "sandals", "boots", "heels"],
  dress: ["dress", "gown", "frock", "kurti"],
  top: ["top", "shirt", "blouse", "tshirt", "tee"],
  watch: ["watch", "smartwatch"],
  phone: ["phone", "smartphone", "mobile", "iphone", "android", "cellphone", "oneplus", "samsung", "xiaomi", "realme"],
  laptop: ["laptop", "notebook", "ultrabook", "macbook", "chromebook"],
  headphones: ["headphone", "headphones", "earphone", "earphones", "earbuds", "headset", "airpods", "tws"],
  tablet: ["tablet", "ipad", "tab"],
  camera: ["camera", "dslr", "mirrorless", "action cam", "gopro", "camcorder"],
  tv: ["tv", "television", "smart tv", "oled", "qled", "led tv"],
  beauty: ["lipstick", "foundation", "serum", "moisturizer", "sunscreen", "perfume", "fragrance", "makeup", "cosmetic"],
  home: ["blender", "mixer", "vacuum", "air fryer", "microwave", "refrigerator", "washing machine", "appliance"],
  fitness: ["dumbbell", "yoga mat", "treadmill", "exercise bike", "kettlebell", "resistance band", "gym equipment"],
  person: ["person", "face", "selfie", "portrait", "human"],
};

const TYPE_QUERY_HINTS = {
  bag: "handbag purse tote sling backpack bag for women",
  shoes: "shoe shoes sneakers footwear",
  phone: "smartphone mobile phone",
  top: "top shirt blouse tshirt",
  dress: "dress gown frock",
  watch: "watch smartwatch",
  laptop: "laptop notebook ultrabook macbook",
  headphones: "headphones earbuds earphones headset tws",
  tablet: "tablet ipad android tab",
  camera: "camera dslr mirrorless action cam",
  tv: "smart tv oled qled television",
  beauty: "beauty skincare makeup serum lipstick",
  home: "home appliance kitchen appliance",
  fitness: "fitness gym equipment dumbbell yoga mat",
};

const PLATFORM_FILTER_BASE_OPTIONS = ["Amazon", "Flipkart", "Myntra"];

const APPAREL_KEYWORDS = [
  ...TYPE_GROUPS.top,
  ...TYPE_GROUPS.dress,
  "kurta",
  "tunic",
  "sweater",
  "cardigan",
  "hoodie",
  "jacket",
];

const NON_APPAREL_BLOCKLIST = [
  ...TYPE_GROUPS.phone,
  ...TYPE_GROUPS.laptop,
  ...TYPE_GROUPS.headphones,
  ...TYPE_GROUPS.tablet,
  ...TYPE_GROUPS.camera,
  ...TYPE_GROUPS.tv,
  ...TYPE_GROUPS.watch,
  "protein",
  "whey",
  "supplement",
  "powder",
  "mass gainer",
  "laptop",
  "camera",
  "headphone",
  "earbuds",
  "charger",
  "tablet",
];

const ACCESSORY_BLOCKLIST_BY_TYPE = {
  phone: ["phone case", "cover", "tempered", "screen guard", "protector", "back cover", "charger cable"],
  laptop: ["laptop sleeve", "laptop bag", "keyboard cover", "stand", "dock", "adapter"],
  tablet: ["tablet case", "flip cover", "stylus", "screen guard"],
  headphones: ["ear tips", "audio cable", "replacement pad"],
  camera: ["tripod", "camera bag", "sd card", "memory card", "lens cap", "camera strap"],
  watch: ["watch strap", "band", "screen protector"],
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

const isGenericVisionLabel = (value) => GENERIC_VISION_LABELS.has(normalizeText(value));

const PIPELINE_VERSION = "vision-v2.1";

const canonicalizeType = (value) => {
  const token = normalizeText(value);
  if (!token || isGenericVisionLabel(token)) return "";

  if (TYPE_GROUPS[token]) return token;
  for (const [type, aliases] of Object.entries(TYPE_GROUPS)) {
    if (aliases.some((alias) => token.includes(alias))) return type;
  }
  return "";
};

const buildImageSignalSearchQuery = ({ detectedColor, requestedType, fallbackQuery }) =>
  [detectedColor, requestedType, fallbackQuery]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const isImageIntentReliable = ({ requestedType, detectedColor, signals = {}, intentMeta = {} }) => {
  const checks = [
    Boolean(requestedType),
    Boolean(detectedColor),
    Boolean(signals?.pattern || intentMeta?.pattern),
    Boolean(signals?.material || intentMeta?.material),
    Boolean(signals?.style || intentMeta?.style),
    Boolean(signals?.gender || intentMeta?.gender),
  ];
  const score = checks.filter(Boolean).length;
  return {
    reliable: score >= 2,
    score,
  };
};

const detectRequestedType = (searchQuery, includeKeywords) => {
  const hay = normalizeText([searchQuery, ...(includeKeywords || [])].join(" "));
  const canonical = canonicalizeType(hay);
  if (canonical) return canonical;
  for (const [type, aliases] of Object.entries(TYPE_GROUPS)) {
    if (aliases.some((alias) => hay.includes(alias))) return type;
  }
  return "";
};

const typeMatchScore = (hay, requestedType) => {
  if (!requestedType) return 0;
  const requestedAliases = TYPE_GROUPS[requestedType] || [requestedType];
  const hasRequestedType = requestedAliases.some((alias) => hay.includes(alias));
  if (!hasRequestedType) return -28;

  let penalty = 0;
  for (const [type, aliases] of Object.entries(TYPE_GROUPS)) {
    if (type === requestedType) continue;
    if (aliases.some((alias) => hay.includes(alias))) {
      penalty -= 10;
    }
  }
  return 20 + penalty;
};

const filterByRequestedType = (products, requestedType) => {
  if (!requestedType || !Array.isArray(products)) return products;
  const aliases = TYPE_GROUPS[requestedType] || [requestedType];
  const filtered = products.filter((product) => {
    const hay = productSearchText(product);
    return aliases.some((alias) => hay.includes(alias));
  });
  return filtered;
};

const getPriceValue = (product) => {
  const raw = String(product?.price || '').replace(/[^0-9.]/g, '');
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const buildPriceSummary = (products) => {
  const values = (products || []).map(getPriceValue).filter((v) => v !== null);
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return `Price around INR ${Math.round(min)}.`;
  return `Price range INR ${Math.round(min)} to INR ${Math.round(max)}.`;
};

const buildExpandedTypeQuery = (baseQuery, requiredType) => {
  const hint = TYPE_QUERY_HINTS[requiredType] || requiredType || "";
  const merged = `${baseQuery || ""} ${hint}`.trim();
  return merged.replace(/\s+/g, " ").trim();
};

const passesStrongTypeGuard = (product, requestedType) => {
  if (!requestedType) return true;
  const hay = productSearchText(product);
  const requestedAliases = TYPE_GROUPS[requestedType] || [requestedType];
  const hasRequestedToken = requestedAliases.some((token) => hay.includes(token));
  if (!hasRequestedToken) return false;

  if (requestedType === "bag") {
    const bagWords = TYPE_GROUPS.bag;
    const apparelWords = [...TYPE_GROUPS.top, ...TYPE_GROUPS.dress];
    const hasBagWord = bagWords.some((w) => hay.includes(w));
    const hasOnlyApparel = apparelWords.some((w) => hay.includes(w)) && !hasBagWord;
    return hasBagWord && !hasOnlyApparel;
  }

  if (requestedType === "shoes") {
    const shoeWords = TYPE_GROUPS.shoes;
    const apparelWords = [...TYPE_GROUPS.top, ...TYPE_GROUPS.dress];
    const hasShoeWord = shoeWords.some((w) => hay.includes(w));
    const hasOnlyApparel = apparelWords.some((w) => hay.includes(w)) && !hasShoeWord;
    return hasShoeWord && !hasOnlyApparel;
  }

  if (requestedType === "phone") {
    const phoneWords = TYPE_GROUPS.phone;
    const apparelWords = [...TYPE_GROUPS.top, ...TYPE_GROUPS.dress, ...TYPE_GROUPS.bag];
    const hasPhoneWord = phoneWords.some((w) => hay.includes(w));
    const hasOnlyNonPhone = apparelWords.some((w) => hay.includes(w)) && !hasPhoneWord;
    return hasPhoneWord && !hasOnlyNonPhone;
  }

  if (["laptop", "headphones", "tablet", "camera", "tv", "watch"].includes(requestedType)) {
    const accessoryTerms = ACCESSORY_BLOCKLIST_BY_TYPE[requestedType] || [];
    const hasAccessoryTerm = accessoryTerms.some((term) => hay.includes(normalizeText(term)));
    if (hasAccessoryTerm) return false;
  }

  if (requestedType === "top" || requestedType === "dress") {
    const hasApparelWord = APPAREL_KEYWORDS.some((w) => hay.includes(w));
    const hasBlockedWord = NON_APPAREL_BLOCKLIST.some((w) => hay.includes(w));
    if (!hasApparelWord || hasBlockedWord) return false;

    const hasMen = /\bmen\b|\bmens\b|\bman\b/.test(hay);
    const hasWomen = /\bwomen\b|\bwomens\b|\bladies\b|\bgirls\b/.test(hay);
    if (hasMen && !hasWomen) return false;

    if (requestedType === "dress") {
      const hasDressWord = TYPE_GROUPS.dress.some((w) => hay.includes(w));
      if (!hasDressWord) return false;
    }
  }

  return true;
};

const filterLowConfidenceResults = (products, requestedType, minScore = 45) => {
  return (products || []).filter((product) => {
    const score = Number(product?.aiScore) || 0;
    if (!requestedType) return score >= minScore;
    const strongTypeMatch = passesStrongTypeGuard(product, requestedType);
    if (strongTypeMatch && score >= 20) return true;
    return score >= minScore;
  });
};

const COLOR_GROUPS = {
  white: ["white", "offwhite", "ivory", "cream", "beige"],
  black: ["black", "charcoal", "jetblack"],
  red: ["red", "maroon", "burgundy", "crimson", "wine"],
  blue: ["blue", "navy", "skyblue", "teal", "cyan"],
  green: ["green", "olive", "mint", "emerald", "sea green", "seagreen"],
  yellow: ["yellow", "mustard", "gold"],
  pink: ["pink", "rose", "fuchsia", "magenta"],
  purple: ["purple", "violet", "lavender"],
  orange: ["orange", "peach", "coral"],
  brown: ["brown", "tan", "khaki", "camel"],
  grey: ["grey", "gray", "silver"],
};

const detectRequestedColor = (searchQuery, includeKeywords) => {
  const tokens = normalizeText([searchQuery, ...(includeKeywords || [])].join(" "));
  for (const [base, aliases] of Object.entries(COLOR_GROUPS)) {
    if (aliases.some((alias) => tokens.includes(alias))) return base;
  }
  return "";
};

const colorMatchScore = (hay, requestedColor) => {
  if (!requestedColor) return 0;
  const requestedAliases = COLOR_GROUPS[requestedColor] || [requestedColor];
  const hasRequested = requestedAliases.some((alias) => hay.includes(alias));
  if (!hasRequested) return -15;

  let penalty = 0;
  for (const [base, aliases] of Object.entries(COLOR_GROUPS)) {
    if (base === requestedColor) continue;
    if (aliases.some((alias) => hay.includes(alias))) {
      penalty -= 6;
    }
  }

  return 14 + penalty;
};

const hasColorMatch = (hay, requestedColor) => {
  if (!requestedColor) return false;
  const aliases = COLOR_GROUPS[requestedColor] || [requestedColor];
  return aliases.some((alias) => hay.includes(alias));
};

const computeCalibratedMatchScore = (product, { requestedType, requestedColor }) => {
  const hay = productSearchText(product);
  let score = 28;

  if (requestedType) {
    score += passesStrongTypeGuard(product, requestedType) ? 30 : -28;
  } else {
    score += 6;
  }

  if (requestedColor) {
    score += hasColorMatch(hay, requestedColor) ? 16 : -10;
  } else {
    score += 4;
  }

  if (product?.image) score += 7;
  if (Number(String(product?.price || "").replace(/[^0-9.]/g, "")) > 0) score += 5;
  if ((Number(product?.rating) || 0) >= 4) score += 5;
  if (normalizeText(product?.aiReason || "").includes("fallback result")) score -= 18;

  return Math.max(8, Math.min(96, Math.round(score)));
};

const sanitizeRecommendationQuery = (value) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  const normalized = normalizeText(text);
  const leakedPromptMarkers = [
    "assistant_reply",
    "search_query",
    "include_keywords",
    "exclude_keywords",
    "confidence",
    "concise ecommerce phrase",
    "return strict json",
  ];

  if (leakedPromptMarkers.some((marker) => normalized.includes(marker))) {
    return "";
  }

  if (/^\.\//.test(text) || text.length > 120) {
    return "";
  }

  return text;
};

const sanitizeAssistantSummary = (value) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  const normalized = normalizeText(text);
  const leakedPromptMarkers = [
    "assistant_reply",
    "search_query",
    "include_keywords",
    "exclude_keywords",
    "confidence",
    "concise ecommerce phrase",
    "return strict json",
    "short explanation",
  ];

  const looksLikeLeakedJson =
    (text.startsWith("{") || text.startsWith("[")) &&
    leakedPromptMarkers.some((marker) => normalized.includes(marker));

  if (looksLikeLeakedJson) return "";
  if (leakedPromptMarkers.filter((marker) => normalized.includes(marker)).length >= 2) return "";
  if (normalized.includes("./assistant_reply")) return "";

  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  return cleaned.slice(0, 220);
};

const isLowValueSummary = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return true;
  if (normalized === "detected product") return true;
  if (normalized === "product detected from image") return true;
  if (normalized === "detected items") return true;
  return normalized.length < 18;
};

const isPlaceholderProduct = (product, { strict = true } = {}) => {
  const title = normalizeText(
    pickFirstNonEmpty(
      product?.title,
      product?.name,
      product?.product_name,
      product?.productName
    )
  );
  if (!title) return true;

  const genericTitles = new Set(["product", "item", "unknown product", "fallback result"]);
  if (genericTitles.has(title)) return true;

  const aiReason = normalizeText(
    pickFirstNonEmpty(product?.aiReason, product?.reason)
  );
  if (aiReason === "fallback result") return true;

  const hasImage = Boolean(resolveProductImage(product));
  const hasUrl = Boolean(resolveProductUrl(product));
  const hasPrice = extractPricing(product).currentPrice > 0;
  const hasPlatform = Boolean(
    pickFirstNonEmpty(
      product?.platform,
      product?.source,
      product?.store,
      product?.marketplace
    )
  );
  const hasAnySignal = hasImage || hasUrl || hasPrice || hasPlatform;

  if (!strict) {
    // In text mode, keep sparse but valid catalog rows if title is meaningful.
    return false;
  }

  // Require at least one meaningful commerce signal.
  if (!(hasImage || hasUrl || hasPrice)) return true;

  // Query-echo placeholders usually mirror user query and contain no commerce data.
  const hasMinimalTitle = title.split(" ").length <= 2;
  if (hasMinimalTitle && !hasImage && !hasPrice) return true;

  return false;
};

const buildFriendlyResultSummary = ({
  finalSearchQuery,
  requestedType,
  detectedColor,
  hasImage,
  strictVisionMode,
}) => {
  const typePart = requestedType || "products";
  const colorPart = detectedColor ? `${detectedColor} ` : "";
  const modePart = hasImage && strictVisionMode ? " using strict image matching" : "";

  if (hasImage) {
    return `I found ${colorPart}${typePart} that look closest to your image${modePart}.`;
  }
  return `I found results for "${finalSearchQuery}" that best match your request.`;
};

const buildUserFacingSuccessText = ({
  hasImage,
  finalSearchQuery,
  requestedType,
  detectedColor,
  products,
}) => {
  const count = Array.isArray(products) ? products.length : 0;
  const typeLabel = requestedType || "products";
  const colorPrefix = detectedColor ? `${detectedColor} ` : "";

  if (hasImage) {
    return `I found ${count} ${colorPrefix}${typeLabel} options similar to your image.`;
  }
  return `I found ${count} products for "${finalSearchQuery}".`;
};

const buildPlatformSearchFallbackProducts = ({
  query,
  requestedType,
  detectedColor,
}) => {
  const dedupedQuery = String(
    [query, detectedColor, requestedType].filter(Boolean).join(" ")
  )
    .split(/\s+/)
    .filter(Boolean)
    .filter((token, index, arr) => {
      const normalizedToken = normalizeText(token);
      return arr.findIndex((item) => normalizeText(item) === normalizedToken) === index;
    })
    .join(" ");
  const safeQuery = sanitizeRecommendationQuery(
    dedupedQuery.trim()
  );
  if (!safeQuery) return [];

  const encoded = encodeURIComponent(safeQuery);
  const seedTitle = safeQuery.replace(/\s+/g, " ").trim();

  return [
    {
      id: `fallback-amazon-${encoded}`,
      title: seedTitle,
      platform: "Amazon",
      url: `https://www.amazon.in/s?k=${encoded}`,
      image: "",
      price: 0,
      originalPrice: 0,
      rating: 0,
      reviews: 0,
      aiScore: 55,
      aiReason: "Direct marketplace search fallback",
      features: ["Opens live search results on Amazon"],
    },
    {
      id: `fallback-flipkart-${encoded}`,
      title: seedTitle,
      platform: "Flipkart",
      url: `https://www.flipkart.com/search?q=${encoded}`,
      image: "",
      price: 0,
      originalPrice: 0,
      rating: 0,
      reviews: 0,
      aiScore: 52,
      aiReason: "Direct marketplace search fallback",
      features: ["Opens live search results on Flipkart"],
    },
    {
      id: `fallback-myntra-${encoded}`,
      title: seedTitle,
      platform: "Myntra",
      url: `https://www.myntra.com/${encoded}`,
      image: "",
      price: 0,
      originalPrice: 0,
      rating: 0,
      reviews: 0,
      aiScore: 50,
      aiReason: "Direct marketplace search fallback",
      features: ["Opens live search results on Myntra"],
    },
  ];
};

const buildSafeFallbackQuery = ({ requestedType, detectedColor, includeKeywords, effectiveQuery }) => {
  const cleanSeed = sanitizeRecommendationQuery(effectiveQuery);
  if (cleanSeed) return cleanSeed;

  const typeHint = TYPE_QUERY_HINTS[requestedType] || requestedType || "fashion product";
  const colorHint = String(detectedColor || "").trim();
  const keywordHint = (includeKeywords || [])
    .map((k) => String(k || "").trim())
    .filter((k) => k.length > 2)
    .slice(0, 3)
    .join(" ");
  return [colorHint, typeHint, keywordHint].filter(Boolean).join(" ").trim();
};

const buildRecommendationQueryCandidates = ({
  finalSearchQuery,
  requestedType,
  detectedColor,
  signals = {},
  includeKeywords,
  effectiveQuery,
  imageName = "",
  hasImage = false,
  forceUserQuery = false,
}) => {
  const candidates = [];
  const pushCandidate = (value) => {
    const query = sanitizeRecommendationQuery(value);
    if (!query) return;
    if (!candidates.includes(query)) candidates.push(query);
  };

  pushCandidate(finalSearchQuery);
  pushCandidate(buildSafeFallbackQuery({ requestedType, detectedColor, includeKeywords, effectiveQuery }));

  if (requestedType) {
    pushCandidate(buildExpandedTypeQuery(finalSearchQuery, requestedType));
    pushCandidate(TYPE_QUERY_HINTS[requestedType] || requestedType);
    pushCandidate(requestedType);
    pushCandidate(`${detectedColor || ""} ${requestedType}`.trim());
  }

  const attributeHint = [
    detectedColor,
    signals?.gender,
    signals?.pattern,
    signals?.material,
    signals?.style,
    requestedType,
  ].filter(Boolean).join(" ");
  pushCandidate(attributeHint);

  const styleHints = (includeKeywords || [])
    .map((k) => normalizeText(k))
    .filter(Boolean)
    .filter((k) => !["men", "mens", "man"].includes(k))
    .filter((k) => !TYPE_GROUPS.person.includes(k))
    .slice(0, 5)
    .join(" ");

  if (requestedType === "top" || requestedType === "dress") {
    pushCandidate(`${detectedColor || ""} women ${requestedType} ${styleHints}`.trim());
    pushCandidate(`${detectedColor || ""} women blouse floral top`.trim());
  } else if (requestedType) {
    pushCandidate(`${detectedColor || ""} ${requestedType} ${styleHints}`.trim());
  }

  if (!hasImage || !requestedType || forceUserQuery) {
    pushCandidate(effectiveQuery);
  }
  if (hasImage) {
    pushCandidate(`${requestedType || ""} ${imageName || ""}`.trim());
  }
  return candidates.slice(0, 6);
};

const normalizeUserTextQuery = (value) => {
  const query = String(value || "").trim();
  if (!query) return "";
  return query
    .replace(/\bgalaxy\s+a\s*series\b/i, "samsung galaxy a series smartphone")
    .replace(/\bcell\s*phone\b/i, "smartphone")
    .replace(/\bbags\b/i, "bag")
    .replace(/\bshoes\b/i, "shoe")
    .replace(/\bdresses\b/i, "dress")
    .replace(/\btops\b/i, "top")
    .trim();
};

const mergeRecommendationsByIdentity = (groups) => {
  const merged = [];
  const seen = new Set();

  for (const group of groups) {
    for (const product of Array.isArray(group) ? group : []) {
      const key = normalizeText([
        product?.title,
        product?.platform,
        product?.price,
        product?.url,
      ].join("|"));
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(product);
    }
  }

  return merged;
};

const summarizeVisionDetectedItems = (detectedItems) => {
  if (!Array.isArray(detectedItems) || detectedItems.length === 0) return "";
  const labels = detectedItems
    .map((item) => item?.subtype || item?.category)
    .filter((label) => !isGenericVisionLabel(label))
    .filter(Boolean)
    .slice(0, 3);
  if (labels.length === 0) return "";
  return `Detected items: ${labels.join(", ")}.`;
};

const deriveVisionSignals = (detectedItems) => {
  if (!Array.isArray(detectedItems) || detectedItems.length === 0) {
    return {
      type: "",
      color: "",
      category: "",
      gender: "",
      pattern: "",
      material: "",
      style: "",
      sleeve: "",
      neckline: "",
      fit: "",
    };
  }

  const first = detectedItems[0] || {};
  const rawSubtype = normalizeText(first?.subtype || "");
  const rawCategory = normalizeText(first?.category || "");
  const subtype = isGenericVisionLabel(rawSubtype) ? "" : rawSubtype;
  const category = isGenericVisionLabel(rawCategory) ? "" : rawCategory;
  const attrs = first?.attributes && typeof first.attributes === "object"
    ? first.attributes
    : {};
  const color = normalizeText(attrs?.color || attrs?.primary_color || "");
  const gender = normalizeText(attrs?.gender || attrs?.target_gender || "");
  const pattern = normalizeText(attrs?.pattern || attrs?.print || "");
  const material = normalizeText(attrs?.material || attrs?.fabric || "");
  const style = normalizeText(attrs?.style || attrs?.occasion || "");
  const sleeve = normalizeText(attrs?.sleeve || attrs?.sleeve_type || "");
  const neckline = normalizeText(attrs?.neckline || "");
  const fit = normalizeText(attrs?.fit || "");

  const inferredTypeRaw =
    subtype ||
    (category === "bags"
      ? "bag"
      : category === "footwear"
        ? "shoes"
        : category === "gadgets"
          ? "phone"
          : category === "apparel"
            ? "top"
            : category);
  const inferredType = canonicalizeType(inferredTypeRaw);

  const normalizedColor = Object.keys(COLOR_GROUPS).find((base) => {
    const aliases = COLOR_GROUPS[base] || [base];
    return aliases.some((alias) => color.includes(normalizeText(alias)));
  }) || "";

  return {
    type: inferredType,
    color: normalizedColor,
    category,
    gender,
    pattern,
    material,
    style,
    sleeve,
    neckline,
    fit,
  };
};

const rerankRecommendations = (products, { searchQuery, includeKeywords, excludeKeywords }) => {
  if (!Array.isArray(products)) return [];
  const requestedType = detectRequestedType(searchQuery, includeKeywords);
  const requestedColor = detectRequestedColor(searchQuery, includeKeywords);

  const include = Array.from(
    new Set([...(includeKeywords || []), ...(searchQuery || "").split(/\s+/)])
  )
    .map(normalizeText)
    .filter((token) => token.length > 2);
  const exclude = Array.from(new Set(excludeKeywords || []))
    .map(normalizeText)
    .filter(Boolean);

  return [...products]
    .map((product) => {
      const hay = productSearchText(product);
      let score = Number(product?.aiScore) || 0;

      for (const token of include) {
        if (hay.includes(token)) score += token.length > 6 ? 8 : 5;
      }
      for (const token of exclude) {
        if (hay.includes(token)) score -= 12;
      }
      score += typeMatchScore(hay, requestedType);
      score += colorMatchScore(hay, requestedColor);

      return { ...product, _smartpickScore: score };
    })
    .sort((a, b) => (b._smartpickScore || 0) - (a._smartpickScore || 0))
    .map(({ _smartpickScore, ...rest }) => rest);
};

const buildFailureMessageFromErrorCode = (errorCode) => {
  if (errorCode === 'quota_exceeded') {
    return 'Vision provider quota is currently exhausted. I used fallback detection, but retry later for best accuracy.';
  }
  if (errorCode === 'invalid_key' || errorCode === 'missing_key') {
    return 'AI provider key is missing or invalid. Add a valid API key in .env.local for accurate image detection.';
  }
  if (errorCode === 'unsupported_model') {
    return 'Configured vision model is unavailable. Check your VITE_OLLAMA_VISION_MODEL value.';
  }
  if (errorCode === 'network_error' || errorCode === 'missing_server') {
    return 'Vision backend is unavailable. Start your backend server and verify VITE_API_BASE_URL in .env.local.';
  }
  return 'I could not identify the product type from this image. Add a short hint like "black adidas shoe bag" and try again.';
};

const DEFAULT_PRODUCT_FILTERS = {
  minMatch: 0,
  platforms: [],
  minPrice: "",
  maxPrice: "",
  minRating: 0,
  offerOnly: false,
  search: "",
};

const CHAT_STORAGE_BASE_KEY = "chatSessions";
const STRICT_MODE_BASE_KEY = "visionStrictMode";
const ENABLE_MARKETPLACE_FALLBACK = true;
const CHAT_SIDEBAR_EXPANDED_PX = 300;
const CHAT_SIDEBAR_COLLAPSED_PX = 84;

const sortChatSessions = (sessions = []) =>
  [...sessions].sort((a, b) => {
    if (Boolean(a?.pinned) !== Boolean(b?.pinned)) {
      return a?.pinned ? -1 : 1;
    }
    return new Date(b?.updatedAt || 0).getTime() - new Date(a?.updatedAt || 0).getTime();
  });

const isGenericImageUploadTitle = (value = "") => {
  const normalized = normalizeText(value);
  return (
    normalized === "image uploaded for product analysis" ||
    normalized === "image uploaded" ||
    normalized.startsWith("image uploaded for product")
  );
};

const extractTitleFromAiMessage = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";

  const quoted = text.match(/["']([^"']{2,72})["']/);
  if (quoted?.[1]) return quoted[1].trim();

  const optionsMatch = text.match(/options\s+for\s+([^.]+)\./i);
  if (optionsMatch?.[1]) return optionsMatch[1].replace(/["']/g, "").trim();

  return "";
};

const buildChatTitle = (messages = []) => {
  const userMessages = (messages || []).filter((message) => message?.type === "user");
  const firstMeaningfulUser = userMessages.find((message) => {
    const text = String(message?.content || "").trim();
    return text && !isGenericImageUploadTitle(text);
  });

  const candidateUserText = String(firstMeaningfulUser?.content || "").trim().replace(/\s+/g, " ");
  if (candidateUserText) {
    return candidateUserText.length > 42 ? `${candidateUserText.slice(0, 42)}...` : candidateUserText;
  }

  const firstAiText = String(
    (messages || []).find((message) => message?.type === "ai" && String(message?.content || "").trim())?.content || ""
  ).trim();
  const aiDerivedTitle = extractTitleFromAiMessage(firstAiText).replace(/\s+/g, " ");
  if (aiDerivedTitle) {
    return aiDerivedTitle.length > 42 ? `${aiDerivedTitle.slice(0, 42)}...` : aiDerivedTitle;
  }

  return userMessages.length > 0 ? "Image search" : "New chat";
};

const buildChatPreview = (messages = []) => {
  const last = [...(messages || [])].reverse().find((message) => String(message?.content || "").trim());
  if (!last) return "No messages yet";
  const text = String(last.content || "").trim().replace(/\s+/g, " ");
  return text.length > 56 ? `${text.slice(0, 56)}...` : text;
};

const createEmptyChatSession = (overrides = {}) => ({
  id: overrides.id || crypto.randomUUID(),
  title: "New chat",
  preview: "No messages yet",
  pinned: false,
  updatedAt: new Date().toISOString(),
  messages: [],
  recommendedProducts: [],
  showProducts: false,
  productFilters: { ...DEFAULT_PRODUCT_FILTERS },
  productSort: "match_desc",
  showUnfilteredFallback: false,
  ...overrides,
});

const normalizeChatSession = (session = {}) => {
  const messages = Array.isArray(session.messages) ? session.messages : [];
  return {
    ...createEmptyChatSession(),
    ...session,
    id: String(session.id || crypto.randomUUID()),
    title: session.title || buildChatTitle(messages),
    preview: session.preview || buildChatPreview(messages),
    updatedAt: session.updatedAt || new Date().toISOString(),
    messages,
    recommendedProducts: Array.isArray(session.recommendedProducts) ? session.recommendedProducts : [],
    productFilters: { ...DEFAULT_PRODUCT_FILTERS, ...(session.productFilters || {}) },
    productSort: session.productSort || "match_desc",
    showProducts: Boolean(session.showProducts),
    showUnfilteredFallback: Boolean(session.showUnfilteredFallback),
    pinned: Boolean(session.pinned),
  };
};

const hasConversationContent = (messages = []) => Array.isArray(messages) && messages.length > 0;

const applyRootTheme = (isDarkMode) => {
  const root = document.documentElement;
  if (isDarkMode) {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
  }
};

/* ---------------- APP ---------------- */

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved && saved !== "undefined" ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });


  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  const userScopeId = getUserScopeId(user);
  const chatStorageKey = scopedStorageKey(CHAT_STORAGE_BASE_KEY, user);
  const strictModeStorageKey = scopedStorageKey(STRICT_MODE_BASE_KEY, user);

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [chatReady, setChatReady] = useState(false);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [showCompactHistory, setShowCompactHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [isHistorySearchOpen, setIsHistorySearchOpen] = useState(false);
  const [pendingConversationDelete, setPendingConversationDelete] = useState(null);
  const chatContentRef = useRef(null);
  const chatAnchorUpdateRef = useRef(() => {});
  const [chatDesktopAnchorPx, setChatDesktopAnchorPx] = useState(null);

  const [messages, setMessages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [productFilters, setProductFilters] = useState({ ...DEFAULT_PRODUCT_FILTERS });
  const [productSort, setProductSort] = useState("match_desc");
  const [showUnfilteredFallback, setShowUnfilteredFallback] = useState(false);
  const [strictVisionMode, setStrictVisionMode] = useState(true);

  useEffect(() => {
    if (isAuthPage) {
      // Keep auth screens visually stable and independent from user preference theme.
      applyRootTheme(true);
      return undefined;
    }

    const applyTheme = (prefs) => applyRootTheme(Boolean(prefs?.darkMode));
    applyTheme(readPreferences(user));
    return subscribePreferences(applyTheme, user);
  }, [isAuthPage, userScopeId]);

  useEffect(() => {
    validateAiConfig();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || isAdmin) return;
    const saved = localStorage.getItem(strictModeStorageKey);
    setStrictVisionMode(saved == null ? true : saved === "true");
  }, [isAuthenticated, isAdmin, strictModeStorageKey]);

  useEffect(() => {
    if (!isAuthenticated || isAdmin) return;
    localStorage.setItem(strictModeStorageKey, strictVisionMode ? "true" : "false");
  }, [strictVisionMode, isAuthenticated, isAdmin, strictModeStorageKey]);

  const applyConversationToView = (conversation) => {
    if (!conversation) {
      setMessages([]);
      setRecommendedProducts([]);
      setShowProducts(false);
      setProductFilters({ ...DEFAULT_PRODUCT_FILTERS });
      setProductSort("match_desc");
      setShowUnfilteredFallback(false);
      return;
    }
    const normalized = normalizeChatSession(conversation);
    setMessages(normalized.messages);
    setRecommendedProducts(normalized.recommendedProducts);
    setShowProducts(normalized.showProducts);
    setProductFilters(normalized.productFilters);
    setProductSort(normalized.productSort);
    setShowUnfilteredFallback(normalized.showUnfilteredFallback);
  };

  useEffect(() => {
    if (!isAuthenticated || isAdmin) {
      setConversations([]);
      setActiveConversationId(null);
      setChatReady(false);
      setMessages([]);
      setRecommendedProducts([]);
      setShowProducts(false);
      setProductFilters({ ...DEFAULT_PRODUCT_FILTERS });
      setProductSort("match_desc");
      setShowUnfilteredFallback(false);
      return;
    }

    setChatReady(false);
    let parsed = null;
    try {
      parsed = JSON.parse(localStorage.getItem(chatStorageKey) || "null");
    } catch {
      parsed = null;
    }

    const loadedSessions = Array.isArray(parsed?.sessions)
      ? parsed.sessions.map(normalizeChatSession)
      : [];
    const sessions = sortChatSessions(
      loadedSessions.filter((session) => hasConversationContent(session.messages))
    );
    const preferredId = String(parsed?.activeConversationId || "");
    const active = sessions.find((session) => session.id === preferredId) || null;

    setConversations(sessions);
    setActiveConversationId(active?.id || null);
    applyConversationToView(active);
    setChatReady(true);
  }, [isAuthenticated, isAdmin, chatStorageKey, userScopeId]);

  useEffect(() => {
    if (!chatReady || !isAuthenticated || isAdmin || !activeConversationId) return;

    setConversations((prev) => {
      const snapshot = {
        messages,
        recommendedProducts,
        showProducts,
        productFilters,
        productSort,
        showUnfilteredFallback,
      };

      const nextMessages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
      const shouldPersist = hasConversationContent(nextMessages);
      const exists = prev.some((session) => session.id === activeConversationId);

      if (!shouldPersist) {
        return exists
          ? sortChatSessions(prev.filter((session) => session.id !== activeConversationId))
          : prev;
      }

      const base = exists
        ? prev
        : [createEmptyChatSession({ id: activeConversationId }), ...prev];

      return sortChatSessions(
        base.map((session) => {
          if (session.id !== activeConversationId) return session;
          return normalizeChatSession({
            ...session,
            ...snapshot,
            title: buildChatTitle(nextMessages),
            preview: buildChatPreview(nextMessages),
            updatedAt: new Date().toISOString(),
          });
        })
      );
    });
  }, [
    chatReady,
    isAuthenticated,
    isAdmin,
    activeConversationId,
    messages,
    recommendedProducts,
    showProducts,
    productFilters,
    productSort,
    showUnfilteredFallback,
    chatStorageKey,
  ]);

  useEffect(() => {
    if (!chatReady || !isAuthenticated || isAdmin) return;
    localStorage.setItem(
      chatStorageKey,
      JSON.stringify({
        activeConversationId,
        sessions: conversations,
      })
    );
  }, [chatReady, isAuthenticated, isAdmin, chatStorageKey, activeConversationId, conversations]);

  const startNewChat = () => {
    const freshId = crypto.randomUUID();
    setActiveConversationId(freshId);
    setShowCompactHistory(false);
    applyConversationToView(null);
    navigate("/chat");
  };

  const activateConversation = (conversationId) => {
    const next = conversations.find((conversation) => conversation.id === conversationId);
    if (!next) return;
    setActiveConversationId(next.id);
    setShowCompactHistory(false);
    applyConversationToView(next);
    navigate("/chat");
  };

  const togglePinConversation = (conversationId) => {
    setConversations((prev) =>
      sortChatSessions(
        prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, pinned: !conversation.pinned, updatedAt: new Date().toISOString() }
            : conversation
        )
      )
    );
  };

  const deleteConversation = (conversationId) => {
    setConversations((prev) => {
      const next = prev.filter((conversation) => conversation.id !== conversationId);
      const sorted = sortChatSessions(next);
      if (activeConversationId === conversationId) {
        const fallback = sorted[0] || null;
        setActiveConversationId(fallback?.id || null);
        applyConversationToView(fallback);
      }
      return sorted;
    });
  };

  const requestDeleteConversation = (conversation) => {
    if (!conversation?.id) return;
    setPendingConversationDelete({
      id: conversation.id,
      title: conversation.title || "this conversation",
    });
  };

  useEffect(() => {
    let rafId = null;
    let transitionRafId = null;
    let resizeObserver = null;

    const updateAnchor = () => {
      if (!chatContentRef.current || window.innerWidth < 1280 || location.pathname !== "/chat") {
        setChatDesktopAnchorPx((prev) => (prev === null ? prev : null));
        return;
      }
      const rect = chatContentRef.current.getBoundingClientRect();
      const nextAnchor = rect.left + rect.width / 2;
      setChatDesktopAnchorPx((prev) =>
        prev === null || Math.abs(prev - nextAnchor) > 0.5 ? nextAnchor : prev
      );
    };
    chatAnchorUpdateRef.current = updateAnchor;

    const scheduleAnchorUpdate = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateAnchor);
    };

    scheduleAnchorUpdate();
    window.addEventListener("resize", scheduleAnchorUpdate);
    window.addEventListener("scroll", scheduleAnchorUpdate, { passive: true });

    if (typeof ResizeObserver !== "undefined" && chatContentRef.current) {
      resizeObserver = new ResizeObserver(scheduleAnchorUpdate);
      resizeObserver.observe(chatContentRef.current);
      if (chatContentRef.current.parentElement) {
        resizeObserver.observe(chatContentRef.current.parentElement);
      }
    }

    const transitionStartedAt = performance.now();
    const sampleWhileAnimating = () => {
      scheduleAnchorUpdate();
      if (performance.now() - transitionStartedAt < 320) {
        transitionRafId = requestAnimationFrame(sampleWhileAnimating);
      }
    };
    transitionRafId = requestAnimationFrame(sampleWhileAnimating);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (transitionRafId) cancelAnimationFrame(transitionRafId);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleAnchorUpdate);
      window.removeEventListener("scroll", scheduleAnchorUpdate);
      chatAnchorUpdateRef.current = () => {};
    };
  }, [location.pathname, isHistoryCollapsed, conversations.length, showProducts]);

  const resetProductFilters = () => {
    setProductFilters({ ...DEFAULT_PRODUCT_FILTERS });
    setProductSort("match_desc");
    setShowUnfilteredFallback(false);
  };

  const availablePlatforms = useMemo(() => {
    const values = Array.from(new Set([
      ...PLATFORM_FILTER_BASE_OPTIONS,
      ...(recommendedProducts || [])
        .map((p) => String(p?.platform || "").trim())
        .filter(Boolean),
    ]));
    return values.sort((a, b) => a.localeCompare(b));
  }, [recommendedProducts]);

  const filteredConversations = useMemo(() => {
    const query = normalizeText(historySearch);
    if (!query) return conversations;
    return conversations.filter((conversation) => {
      const haystack = normalizeText([
        conversation?.title,
        conversation?.preview,
      ].join(" "));
      return haystack.includes(query);
    });
  }, [conversations, historySearch]);

  const filteredAndSortedProducts = useMemo(() => {
    const minPrice = toNumber(productFilters.minPrice);
    const maxPrice = toNumber(productFilters.maxPrice);

    let out = (recommendedProducts || []).filter((p) => {
      const match = Number(p?.aiScore) || 0;
      const platform = normalizeText(p?.platform || "");
      const price = toNumber(p?.price);
      const originalPrice = toNumber(p?.originalPrice);
      const discountPercent = toPercent(p?.discountPercent);
      const hasOffer = Boolean(p?.hasOffer) || discountPercent > 0 || (originalPrice > price && price > 0);
      const rating = Number(p?.rating) || 0;
      const title = normalizeText(p?.title || "");

      if (match < Number(productFilters.minMatch || 0)) return false;
      if (
        productFilters.platforms.length > 0 &&
        !productFilters.platforms
          .map((v) => normalizeText(v))
          .includes(platform)
      ) return false;
      if (minPrice > 0 && (price <= 0 || price < minPrice)) return false;
      if (maxPrice > 0 && (price <= 0 || price > maxPrice)) return false;
      if (rating < Number(productFilters.minRating || 0)) return false;
      if (productFilters.offerOnly && !hasOffer) return false;
      if (productFilters.search && !title.includes(normalizeText(productFilters.search))) return false;
      return true;
    });

    out = [...out].sort((a, b) => {
      if (productSort === "match_desc") return (Number(b.aiScore) || 0) - (Number(a.aiScore) || 0);
      if (productSort === "price_asc") return toNumber(a.price) - toNumber(b.price);
      if (productSort === "price_desc") return toNumber(b.price) - toNumber(a.price);
      if (productSort === "rating_desc") return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      if (productSort === "reviews_desc") return toNumber(b.reviews) - toNumber(a.reviews);
      return 0;
    });

    return out;
  }, [recommendedProducts, productFilters, productSort]);

  const hasActiveProductFilters = useMemo(() => {
    return (
      Number(productFilters.minMatch || 0) > 0 ||
      (productFilters.platforms || []).length > 0 ||
      String(productFilters.minPrice || "").trim() !== "" ||
      String(productFilters.maxPrice || "").trim() !== "" ||
      Number(productFilters.minRating || 0) > 0 ||
      Boolean(productFilters.offerOnly) ||
      String(productFilters.search || "").trim() !== "" ||
      productSort !== "match_desc"
    );
  }, [productFilters, productSort]);

  const fallbackAvailableProducts = useMemo(() => {
    return (recommendedProducts || []).slice(0, 6);
  }, [recommendedProducts]);
  const totalProductsCount = (recommendedProducts || []).length;
  const filteredProductsCount = (filteredAndSortedProducts || []).length;

  /* ---------- AUTH HANDLERS ---------- */

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    applyRootTheme(Boolean(readPreferences(userData).darkMode));
    navigate(userData.role === "admin" ? "/admin" : "/");
  };


  const handleRegister = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    applyRootTheme(Boolean(readPreferences(userData).darkMode));
    navigate("/");
  };


  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    applyRootTheme(true);
    setUser(null);
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
    setRecommendedProducts([]);
    setShowProducts(false);
    setProductFilters({ ...DEFAULT_PRODUCT_FILTERS });
    setProductSort("match_desc");
    setShowUnfilteredFallback(false);
    navigate("/login");
  };


  const handleQuerySubmit = async (payload) => {
    if (!activeConversationId) setActiveConversationId(crypto.randomUUID());

    const requestStartedAt = performance.now();
    const normalizedPayload =
      typeof payload === "string"
        ? { query: payload, source: "text" }
        : (payload || {});
    const {
      query = "",
      source = "text",
      imageDataUrl = null,
      imageName = '',
      audioFile = null,
    } = normalizedPayload;

    let effectiveQuery = normalizeUserTextQuery(query);
    const hasExplicitTextQuery = Boolean(effectiveQuery);

    if (audioFile) {
      try {
        // Audio transcription disabled (OpenAI version)
        // keep original query
        const transcript = "";
        if (transcript) {
          effectiveQuery = [effectiveQuery, transcript].filter(Boolean).join(" ").trim();
        }
      } catch (err) {
        console.error("Audio transcription failed", err);
      }
    }

    if (!effectiveQuery && !imageDataUrl) return;

    const userMessageId = crypto.randomUUID();

    setMessages(prev => [
      ...prev,
      {
        id: userMessageId,
        type: "user",
        source,
        content: effectiveQuery || "Image uploaded for product analysis.",
        imageDataUrl,
      }
    ]);

    setIsThinking(true);

    const buildRealtimeMeta = (productsAnalyzed = 0) => ({
      productsAnalyzed: Math.max(0, Number(productsAnalyzed) || 0),
      elapsedMs: Math.max(0, Math.round(performance.now() - requestStartedAt)),
      mode: imageDataUrl ? "image" : "text",
    });

    try {
      let aiSummary = "";
      let searchQuery = effectiveQuery;
      let includeKeywords = [];
      let excludeKeywords = [];
      let intentMeta = null;
      let visionProducts = null;
      let visionSummary = "";
      let visionDetectedItems = [];
      let visionEndpointReachable = true;

      try {
        const intent = await buildShoppingIntentWithGroq({
          query: effectiveQuery,
          imageDataUrl,
          imageName,
        });
        aiSummary = intent.assistantReply;
        searchQuery = intent.searchQuery || effectiveQuery;
        includeKeywords = intent.includeKeywords || [];
        excludeKeywords = intent.excludeKeywords || [];
        intentMeta = intent.meta || null;

        if ((intent?.confidence || 0) < 0.65) {
          includeKeywords = includeKeywords.filter((token) => String(token || '').length > 2);
        }

        if (intent?.meta?.nonProductImage) {
          setMessages(prev => [
            ...prev,
            {
              id: crypto.randomUUID(),
              type: "ai",
              content: "This looks like a face/person photo, not a product photo. Upload a clear product image (item centered) or add a text hint."
            }
          ]);
          setRecommendedProducts([]);
          setShowProducts(false);
          setShowUnfilteredFallback(false);
          return;
        }
      } catch (err) {
        console.error("Intent generation failed", err);
      }

      if (imageDataUrl) {
        try {
          const vision = await searchByImageVision({
            imageDataUrl,
            textHint: [effectiveQuery, searchQuery].filter(Boolean).join(" ").trim(),
            topK: 24,
            strictCategory: strictVisionMode,
          });
          if (Array.isArray(vision?.products) && vision.products.length > 0) {
            visionProducts = vision.products;
          } else if (Array.isArray(vision?.results) && vision.results.length > 0) {
            visionProducts = vision.results;
          }

          if (Array.isArray(vision?.detectedItems)) {
            visionDetectedItems = vision.detectedItems;
          } else if (Array.isArray(vision?.detected_items)) {
            visionDetectedItems = vision.detected_items;
          }
          visionSummary = summarizeVisionDetectedItems(visionDetectedItems);

        } catch (err) {
          visionEndpointReachable = false;
          console.error("Vision search endpoint failed; falling back to query search", err);
        }
      }

      let finalSearchQuery = sanitizeRecommendationQuery(searchQuery || effectiveQuery || "");
      let visionSignals = deriveVisionSignals(visionDetectedItems);
      const intentRequiredType = isGenericVisionLabel(intentMeta?.requiredType)
        ? ""
        : canonicalizeType(intentMeta?.requiredType || "");
      let requestedType = canonicalizeType(
        visionSignals.type || intentRequiredType || detectRequestedType(finalSearchQuery, includeKeywords)
      );
      let detectedColor = imageDataUrl
        ? (visionSignals.color || intentMeta?.detectedColor || "")
        : (intentMeta?.detectedColor || detectRequestedColor(finalSearchQuery, includeKeywords));
      let safeAiSummary = sanitizeAssistantSummary(aiSummary);
      let hasUsefulAiSummary = !isLowValueSummary(safeAiSummary);
      const intentReliability = isImageIntentReliable({
        requestedType,
        detectedColor,
        signals: visionSignals,
        intentMeta,
      });

      const backendDownForImageSearch =
        Boolean(imageDataUrl) &&
        (
          intentMeta?.errorCode === "missing_server" ||
          intentMeta?.errorCode === "network_error" ||
          !visionEndpointReachable
        );

      if (backendDownForImageSearch) {
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "ai",
            content: "Image search is unavailable because the vision backend is offline. Start your backend on http://localhost:5000 and try again.",
          }
        ]);
        setRecommendedProducts([]);
        setShowProducts(false);
        setShowUnfilteredFallback(false);
        return;
      }

      if (!finalSearchQuery) {
        finalSearchQuery = buildSafeFallbackQuery({
          requestedType,
          detectedColor,
          includeKeywords,
          effectiveQuery,
        });
      }

      let missingVisionSignal =
        Boolean(imageDataUrl) &&
        !requestedType &&
        !detectedColor &&
        (!Array.isArray(visionDetectedItems) || visionDetectedItems.length === 0);

      let genericOnlyVisionSignal =
        Boolean(imageDataUrl) &&
        !requestedType &&
        !detectedColor &&
        (Array.isArray(visionDetectedItems) && visionDetectedItems.length > 0);

      let lowQualityImageIntent =
        Boolean(imageDataUrl) &&
        !effectiveQuery &&
        !intentReliability.reliable;

      if ((missingVisionSignal || genericOnlyVisionSignal || lowQualityImageIntent) && imageDataUrl) {
        const groqFallback = await analyzeImageAttributesWithGroq({
          imageDataUrl,
          textHint: [effectiveQuery, imageName].filter(Boolean).join(" ").trim(),
        });

        if (groqFallback) {
          const fallbackType = canonicalizeType(groqFallback.type || groqFallback.category);
          const fallbackColor = normalizeText(groqFallback.color || "");
          requestedType = requestedType || fallbackType;
          detectedColor = detectedColor || fallbackColor;
          const fallbackKeywords = Array.isArray(groqFallback.includeKeywords)
            ? groqFallback.includeKeywords
            : [];
          includeKeywords = Array.from(new Set([...(includeKeywords || []), ...fallbackKeywords]))
            .map((v) => normalizeText(v))
            .filter(Boolean)
            .slice(0, 10);

          if (groqFallback.searchQuery) {
            finalSearchQuery = sanitizeRecommendationQuery(groqFallback.searchQuery) || finalSearchQuery;
          }
          if (!finalSearchQuery) {
            finalSearchQuery = buildImageSignalSearchQuery({
              detectedColor,
              requestedType,
              fallbackQuery: effectiveQuery,
            });
          }

          safeAiSummary = sanitizeAssistantSummary(
            safeAiSummary ||
              `Detected ${[
                detectedColor,
                groqFallback.gender,
                groqFallback.pattern,
                requestedType,
              ].filter(Boolean).join(" ")} from image.`
          );
          hasUsefulAiSummary = !isLowValueSummary(safeAiSummary);

          visionSignals = {
            ...visionSignals,
            type: requestedType || visionSignals.type,
            color: detectedColor || visionSignals.color,
            category: normalizeText(groqFallback.category || visionSignals.category),
            gender: normalizeText(groqFallback.gender || visionSignals.gender),
            pattern: normalizeText(groqFallback.pattern || visionSignals.pattern),
            material: normalizeText(groqFallback.material || visionSignals.material),
            style: normalizeText(groqFallback.style || visionSignals.style),
            sleeve: normalizeText(groqFallback.sleeve || visionSignals.sleeve),
            neckline: normalizeText(groqFallback.neckline || visionSignals.neckline),
            fit: normalizeText(groqFallback.fit || visionSignals.fit),
          };
        }

        missingVisionSignal =
          Boolean(imageDataUrl) &&
          !requestedType &&
          !detectedColor &&
          (!Array.isArray(visionDetectedItems) || visionDetectedItems.length === 0);

        genericOnlyVisionSignal =
          Boolean(imageDataUrl) &&
          !requestedType &&
          !detectedColor &&
          (Array.isArray(visionDetectedItems) && visionDetectedItems.length > 0);

        lowQualityImageIntent =
          Boolean(imageDataUrl) &&
          !effectiveQuery &&
          !(requestedType || detectedColor);
      }

      if (missingVisionSignal || genericOnlyVisionSignal || lowQualityImageIntent) {
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "ai",
            content: "I could not reliably detect a specific product from this image. Add a short hint like 'blue sneaker' or 'pink floral women top' and try again.",
          }
        ]);
        setRecommendedProducts([]);
        setShowProducts(false);
        setShowUnfilteredFallback(false);
        return;
      }

      if (!finalSearchQuery) {
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "ai",
            content: buildFailureMessageFromErrorCode(intentMeta?.errorCode || ''),
          }
        ]);
        setRecommendedProducts([]);
        setShowProducts(false);
        setShowUnfilteredFallback(false);
        return;
      }

      let products = [];

      if (imageDataUrl) {

        if (Array.isArray(visionProducts) && visionProducts.length > 0) {

          products = visionProducts;

        } else {
          const queryCandidates = buildRecommendationQueryCandidates({
            finalSearchQuery,
            requestedType,
            detectedColor,
            signals: {
              gender: visionSignals?.gender || intentMeta?.gender,
              pattern: visionSignals?.pattern || intentMeta?.pattern,
              material: visionSignals?.material || intentMeta?.material,
              style: visionSignals?.style || intentMeta?.style,
            },
            includeKeywords,
            effectiveQuery,
            imageName,
            hasImage: true,
            forceUserQuery: hasExplicitTextQuery,
          });

          const recommendationGroups = [];
          for (const candidate of queryCandidates) {
            try {
              const candidateResults = await getRecommendations(candidate);
              if (Array.isArray(candidateResults) && candidateResults.length > 0) {
                recommendationGroups.push(candidateResults);
              }
              if (recommendationGroups.length >= 2) break;
            } catch (candidateErr) {
              console.warn("Fallback recommendation query failed:", candidate, candidateErr);
            }
          }

          products = mergeRecommendationsByIdentity(recommendationGroups);

          if ((!Array.isArray(products) || products.length === 0) && hasExplicitTextQuery) {
            try {
              const textResults = await getRecommendations(effectiveQuery);
              products = Array.isArray(textResults) ? textResults : [];
            } catch (textErr) {
              console.warn("Text-first fallback recommendation query failed:", effectiveQuery, textErr);
            }
          }

        }

      } else {

        // TEXT SEARCH ONLY WHEN NO IMAGE
        const queryCandidates = buildRecommendationQueryCandidates({
          finalSearchQuery,
          requestedType,
          detectedColor,
          signals: {
            gender: visionSignals?.gender || intentMeta?.gender,
            pattern: visionSignals?.pattern || intentMeta?.pattern,
            material: visionSignals?.material || intentMeta?.material,
            style: visionSignals?.style || intentMeta?.style,
          },
          includeKeywords,
          effectiveQuery,
          imageName,
          hasImage: false,
          forceUserQuery: true,
        });

        const recommendationGroups = [];
        for (const candidate of queryCandidates) {
          try {
            const candidateResults = await getRecommendations(candidate);
            if (Array.isArray(candidateResults) && candidateResults.length > 0) {
              recommendationGroups.push(candidateResults);
            }
            if (recommendationGroups.length >= 3) break;
          } catch (candidateErr) {
            console.warn("Text candidate recommendation query failed:", candidate, candidateErr);
          }
        }

        products = mergeRecommendationsByIdentity(recommendationGroups);

      }

      const strictImageMode = Boolean(imageDataUrl) && Boolean(strictVisionMode);
      products = (products || []).filter((product) =>
        !isPlaceholderProduct(product, { strict: strictImageMode })
      );

      const rankedProducts = rerankRecommendations(products, {
        searchQuery: finalSearchQuery,
        includeKeywords,
        excludeKeywords,
      });
      const scoredProducts = rankedProducts.map((product) => ({
        ...product,
        aiScore: computeCalibratedMatchScore(product, {
          requestedType,
          requestedColor: detectedColor,
        }),
      }));
      const typeFilteredProducts = filterByRequestedType(scoredProducts, requestedType);
      let finalProducts = requestedType ? typeFilteredProducts : scoredProducts;

      if (requestedType && strictImageMode) {
        finalProducts = finalProducts.filter((product) => passesStrongTypeGuard(product, requestedType));
      }
      if (!imageDataUrl && detectedColor) {
        const colorMatched = finalProducts.filter((product) =>
          hasColorMatch(productSearchText(product), detectedColor)
        );
        if (colorMatched.length > 0) {
          finalProducts = colorMatched;
        }
      }
      const minScoreThreshold =
        !imageDataUrl
          ? 28
          : strictImageMode
            ? (!intentReliability.reliable ? 62 : 50)
            : (!intentReliability.reliable ? 45 : 30);
      finalProducts = filterLowConfidenceResults(finalProducts, requestedType, minScoreThreshold);

      // Emergency broad-match recovery for image searches:
      // if strict pipeline finds no products, retry with softer thresholds and broader typed queries.
      if ((!Array.isArray(finalProducts) || finalProducts.length === 0) && imageDataUrl && requestedType && !strictImageMode) {
        const emergencyCandidates = buildRecommendationQueryCandidates({
          finalSearchQuery,
          requestedType,
          detectedColor,
          signals: {
            gender: visionSignals?.gender || intentMeta?.gender,
            pattern: visionSignals?.pattern || intentMeta?.pattern,
            material: visionSignals?.material || intentMeta?.material,
            style: visionSignals?.style || intentMeta?.style,
          },
          includeKeywords,
          effectiveQuery,
          imageName,
          hasImage: true,
          forceUserQuery: true,
        });

        const emergencyGroups = [];
        for (const candidate of emergencyCandidates) {
          try {
            const candidateResults = await getRecommendations(candidate);
            if (Array.isArray(candidateResults) && candidateResults.length > 0) {
              emergencyGroups.push(candidateResults);
            }
            if (emergencyGroups.length >= 3) break;
          } catch (candidateErr) {
            console.warn("Emergency typed recommendation query failed:", candidate, candidateErr);
          }
        }

        const emergencyProducts = mergeRecommendationsByIdentity(emergencyGroups).filter((product) =>
          !isPlaceholderProduct(product, { strict: false })
        );

        const emergencyRanked = rerankRecommendations(emergencyProducts, {
          searchQuery: finalSearchQuery,
          includeKeywords,
          excludeKeywords,
        }).map((product) => ({
          ...product,
          aiScore: computeCalibratedMatchScore(product, {
            requestedType,
            requestedColor: detectedColor,
          }),
        }));

        const emergencyTyped = filterByRequestedType(emergencyRanked, requestedType);
        finalProducts = filterLowConfidenceResults(emergencyTyped, requestedType, 18);
      }

      // Last-chance plain retrieval for image-only typed requests.
      if ((!Array.isArray(finalProducts) || finalProducts.length === 0) && imageDataUrl && requestedType && !strictImageMode) {
        const plainQueries = [
          `${detectedColor || ""} ${requestedType}`.trim(),
          requestedType,
          TYPE_QUERY_HINTS[requestedType] || "",
        ].filter(Boolean);

        const plainGroups = [];
        for (const plainQuery of plainQueries) {
          try {
            const plainResults = await getRecommendations(plainQuery);
            if (Array.isArray(plainResults) && plainResults.length > 0) {
              plainGroups.push(plainResults);
            }
            if (plainGroups.length >= 2) break;
          } catch (plainErr) {
            console.warn("Plain image fallback query failed:", plainQuery, plainErr);
          }
        }

        const plainProducts = mergeRecommendationsByIdentity(plainGroups)
          .filter((product) => !isPlaceholderProduct(product, { strict: false }));
        const plainRanked = rerankRecommendations(plainProducts, {
          searchQuery: `${detectedColor || ""} ${requestedType}`.trim(),
          includeKeywords,
          excludeKeywords,
        }).map((product) => ({
          ...product,
          aiScore: computeCalibratedMatchScore(product, {
            requestedType,
            requestedColor: detectedColor,
          }),
        }));

        const plainTyped = filterByRequestedType(plainRanked, requestedType)
          .filter((product) => passesStrongTypeGuard(product, requestedType));
        finalProducts = filterLowConfidenceResults(plainTyped, requestedType, 12);
      }

      if (!Array.isArray(finalProducts) || finalProducts.length === 0) {
        const marketplaceFallback = buildPlatformSearchFallbackProducts({
          query: finalSearchQuery || effectiveQuery,
          requestedType,
          detectedColor,
        });

        if (ENABLE_MARKETPLACE_FALLBACK && marketplaceFallback.length > 0) {
          setMessages(prev => [
            ...prev,
            {
              id: crypto.randomUUID(),
              type: "ai",
              analysisMeta: buildRealtimeMeta(marketplaceFallback.length),
              content: `I found live marketplace options for "${finalSearchQuery || effectiveQuery}". Open any card to view exact products.`,
            }
          ]);
          setRecommendedProducts(marketplaceFallback.map(normalizeProductForDisplay));
          resetProductFilters();
          setShowUnfilteredFallback(false);
          setShowProducts(true);
          return;
        }

        const strictHint = strictImageMode
          ? " Try turning Strict Match OFF for broader results."
          : "";
        const typedNoMatchMessage = requestedType && !hasExplicitTextQuery
          ? `I found the product type, but no matching ${requestedType} products are available right now.`
          : '';
        const textNoMatchMessage = hasExplicitTextQuery
          ? `I could not find products for "${effectiveQuery}". Try adding brand, price range, or material.`
          : '';
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "ai",
            analysisMeta: buildRealtimeMeta(0),
            content: typedNoMatchMessage
              ? `${typedNoMatchMessage}${strictHint}`
              : textNoMatchMessage
                ? `${textNoMatchMessage}${strictHint}`
              : (hasUsefulAiSummary
                ? safeAiSummary
                : `I could not find matching products. Try adding color, style, or brand.${strictHint}`)
          }
        ]);

        setRecommendedProducts([]);
        setShowProducts(false);
        setShowUnfilteredFallback(false);
        return;
      }

      const userFacingSummary = buildUserFacingSuccessText({
        hasImage: Boolean(imageDataUrl),
        finalSearchQuery,
        requestedType,
        detectedColor,
        products: finalProducts,
      });
      const priceSummary = buildPriceSummary(finalProducts);

      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "ai",
          detected_items: visionDetectedItems,
          analysisMeta: buildRealtimeMeta(Array.isArray(finalProducts) ? finalProducts.length : 0),
          content: [userFacingSummary, priceSummary].filter(Boolean).join(" ")
        }
      ]);

      setRecommendedProducts((finalProducts || []).map(normalizeProductForDisplay));
      resetProductFilters();
      setShowUnfilteredFallback(false);
      setShowProducts(true);
    } catch (err) {
      console.error(err);

      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "ai",
          analysisMeta: buildRealtimeMeta(0),
          content: "Something went wrong while fetching recommendations."
        }
      ]);
    } finally {
      setIsThinking(false);
    }
  };



  return (
    <div className="min-h-screen bg-background">

      {/* USER HEADER */}
      {isAuthenticated && !isAdmin && (
        <motion.header className="fixed top-0 left-0 right-0 z-40 border-b border-slate-700/45 bg-[linear-gradient(180deg,rgba(13,18,33,0.96),rgba(13,18,33,0.88))] backdrop-blur-xl app-header">
          <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
            <button
              type="button"
              className="flex items-center gap-3 cursor-pointer app-brand text-left"
              onClick={() => navigate("/")}
            >
	              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500/90 via-cyan-500/85 to-emerald-500/80 border border-teal-300/30 shadow-[0_6px_22px_rgba(20,184,166,0.24)] flex items-center justify-center app-brand-badge">
	                <Sparkles className="text-white w-5 h-5 app-brand-icon" />
	              </div>
              <div>
                <h1 className="text-slate-100 font-semibold text-[1.65rem] leading-tight app-brand-title">SmartPick</h1>
                <p className="text-[11px] text-slate-400 leading-none mt-0.5">AI Shopping Assistant</p>
              </div>
            </button>

            <nav className="hidden md:flex items-center gap-1 rounded-2xl bg-slate-900/70 border border-slate-700/70 px-1.5 py-1.5 shadow-[0_10px_24px_rgba(2,6,23,0.45)] app-nav">
              {[
                { path: "/", label: "Home" },
                { path: "/chat", label: "Chat" },
                { path: "/discover", label: "Discover" },
                { path: "/compare", label: "Compare" },
                { path: "/saved", label: "Saved" },
                { path: "/analytics", label: "Analytics" },
                { path: "/profile", label: "Profile" },
              ].map(({ path, label }) => {
                const isActive = location.pathname === path;
                return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`relative px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 app-nav-item ${
                    isActive
                      ? "text-cyan-100 bg-cyan-500/15 border border-cyan-400/45 shadow-[0_6px_14px_rgba(34,211,238,0.2)] app-nav-item-active"
                      : "text-slate-300 border border-transparent hover:text-slate-100 hover:bg-slate-800/75"
                  }`}
                  aria-label={label}
                  title={label}
                >
                  <span className="relative z-10">{label}</span>
                </button>
              )})}
              <div className="mx-1 h-6 w-px bg-slate-700/70 app-nav-divider" />
              <button
                onClick={handleLogout}
                className="px-3.5 py-2 rounded-xl text-sm font-medium text-red-200 border border-red-400/25 hover:border-red-400/40 hover:bg-red-500/10 transition-colors app-nav-logout"
              >
                Logout
              </button>
            </nav>

	            <div className="md:hidden">
	              <button
	                onClick={() => navigate("/saved")}
	                className={
		                  location.pathname === "/saved"
		                    ? "text-teal-600 dark:text-teal-300"
	                    : "text-slate-500 dark:text-slate-400"
	                }
	                aria-label="Saved"
	                title="Saved"
	              >
                <Heart className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.header>
      )}

      <main
        className={
          isAuthenticated
            ? location.pathname === "/"
              ? "pt-16 md:pt-20 pb-0 overflow-hidden"
              : isAdmin
                ? "pt-0 pb-3 md:pb-4"
                : "pt-16 md:pt-20 pb-24 md:pb-0"
            : ""
        }
      >
        <Routes>

          {/* AUTH */}
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/" />
              ) : (
                <LoginPage
                  onLogin={handleLogin}
                  onSwitchToRegister={() => navigate("/register")}
                />
              )
            }
          />

          <Route
            path="/register"
            element={
              isAuthenticated ? (
                <Navigate to="/" />
              ) : (
                <RegisterPage
                  onRegister={handleRegister}
                  onSwitchToLogin={() => navigate("/login")}
                />
              )
            }
          />

          {/* ADMIN */}
          <Route path="/admin" element={
            isAdmin ? <AdminDashboard onLogout={handleLogout} /> : <Navigate to="/" />
          } />

          {/* USER HOME */}
          <Route path="/" element={
            !isAuthenticated
              ? <Navigate to="/login" />
              : isAdmin
                ? <Navigate to="/admin" />
                : <HeroSection onStartClick={() => navigate("/chat")} />
          } />

          {/* CHAT */}
          <Route path="/chat" element={
            isAuthenticated && !isAdmin ? (
              <>
                <div className="w-full px-2 sm:px-3 md:px-4 xl:px-5 pb-36 sm:pb-52 md:pb-56">
                  <div className="grid grid-cols-1 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-start gap-4 xl:gap-5">
                    <motion.aside
                      initial={false}
                      animate={{ width: isHistoryCollapsed ? 92 : 312 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      onUpdate={() => chatAnchorUpdateRef.current()}
                      className="hidden xl:block justify-self-start glass-strong chat-history-panel sp-float-in rounded-2xl border border-slate-700/50 h-fit sticky top-24 overflow-hidden"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {isHistoryCollapsed ? (
                          <motion.div
                            key="collapsed-sidebar"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className="p-2.5 rounded-[24px] w-full"
                          >
                            <div className="mx-auto w-11 flex flex-col items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setIsHistoryCollapsed((prev) => !prev)}
                                className="w-11 h-11 rounded-2xl p-0 inline-flex items-center justify-center border border-slate-700/70 bg-slate-900/60 text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 chat-history-control"
                                title="Expand sidebar"
                              >
                                <PanelLeftOpen className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={startNewChat}
                                className="w-11 h-11 p-0 rounded-2xl bg-slate-800/90 border border-teal-400/35 text-teal-200 inline-flex items-center justify-center chat-history-new"
                                title="New Chat"
                              >
                                <Plus className="w-5 h-5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setIsHistoryCollapsed(false)}
                                className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${
                                  activeConversationId
                                    ? "border-cyan-400/65 bg-cyan-500/12 text-cyan-200 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]"
                                    : "border-slate-700/60 bg-slate-900/40 text-slate-400 hover:bg-slate-800/60"
                                } chat-history-item`}
                                title="Open chat history"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="expanded-sidebar"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.2 }}
                            className="p-3 w-full"
                          >
                            <div className="flex items-center mb-3 justify-between">
                              <span className="text-xs uppercase tracking-wider text-slate-400">
                                Chats
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setIsHistorySearchOpen((prev) => !prev)}
                                  className={`p-2 rounded-lg border chat-history-control ${
                                    historySearch.trim()
                                      ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-100"
                                      : "border-slate-700/70 bg-slate-900/60 text-slate-300 hover:text-slate-100 hover:bg-slate-800/70"
                                  }`}
                                  title="Search chat history"
                                >
                                  <Search className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsHistoryCollapsed((prev) => !prev)}
                                  className="p-2 rounded-lg border border-slate-700/70 bg-slate-900/60 text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 chat-history-control"
                                  title="Collapse sidebar"
                                >
                                  <PanelLeftClose className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {isHistorySearchOpen && (
                              <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                  type="text"
                                  value={historySearch}
                                  onChange={(event) => setHistorySearch(event.target.value)}
                                  placeholder="Search history..."
                                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/50 border border-slate-700/60 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-400/50"
                                />
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={startNewChat}
                              className="w-full mb-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-sky-600 text-white text-sm font-medium inline-flex items-center justify-center gap-2 chat-history-new"
                              title="New Chat"
                            >
                              <Plus className="w-4 h-4" />
                              New Chat
                            </button>

                            <div className="max-h-[70vh] overflow-auto space-y-2 pr-1">
                              {filteredConversations.length === 0 ? (
                                <p className="text-xs text-slate-400 px-1 py-2">
                                  {conversations.length === 0 ? "No chats yet." : "No matching chats."}
                                </p>
                              ) : filteredConversations.map((conversation) => {
                                const isActive = conversation.id === activeConversationId;
                                return (
                                  <button
                                    key={conversation.id}
                                    type="button"
                                    onClick={() => activateConversation(conversation.id)}
                                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                                      isActive
                                        ? "border-cyan-400/50 bg-cyan-500/10"
                                        : "border-slate-700/60 bg-slate-900/40 hover:bg-slate-800/60"
                                    } chat-history-item`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-sm font-medium text-slate-100 line-clamp-1">
                                        {conversation.title}
                                      </p>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <Pin
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            togglePinConversation(conversation.id);
                                          }}
                                          className={`w-4 h-4 ${
                                            conversation.pinned ? "text-cyan-300 fill-cyan-300/40" : "text-slate-500"
                                          }`}
                                        />
                                        <Trash2
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            requestDeleteConversation(conversation);
                                          }}
                                          className="w-4 h-4 text-slate-500 hover:text-red-300"
                                        />
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                                      {conversation.preview}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.aside>

                    <div ref={chatContentRef} className="space-y-6 min-w-0 max-w-full xl:pt-4">
                      <div className="chat-mobile-strip xl:hidden sticky top-[4.45rem] z-20 -mx-2 px-2 py-2 mb-2 sm:mb-1 flex items-center gap-2 overflow-auto bg-[linear-gradient(180deg,rgba(10,14,25,0.96),rgba(10,14,25,0.84))] backdrop-blur-xl border-b border-slate-800/70">
                        <button
                          type="button"
                          onClick={startNewChat}
                          className="shrink-0 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-sky-600 text-white text-xs font-semibold shadow-[0_6px_16px_rgba(16,185,129,0.28)]"
                        >
                          + New
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCompactHistory((prev) => !prev)}
                          className={`chat-mobile-chip shrink-0 px-3 py-2 rounded-xl text-xs border transition-colors ${
                            showCompactHistory
                              ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-100"
                              : "border-slate-700/60 bg-slate-900/50 text-slate-300"
                          }`}
                        >
                          History
                        </button>
                        {filteredConversations.map((conversation) => (
                          <button
                            key={conversation.id}
                            type="button"
                            onClick={() => activateConversation(conversation.id)}
                            className={`chat-mobile-chip shrink-0 max-w-[12rem] truncate px-3 py-2 rounded-xl text-xs border ${
                              conversation.id === activeConversationId
                                ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-100"
                                : "border-slate-700/60 bg-slate-900/50 text-slate-300"
                            }`}
                          >
                            {conversation.title}
                          </button>
                        ))}
                      </div>
                      <AnimatePresence initial={false}>
                        {showCompactHistory && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="xl:hidden mb-2 glass-strong rounded-2xl border border-slate-700/50 p-2.5 space-y-2"
                          >
                            <div className="flex justify-start">
                              <button
                                type="button"
                                onClick={() => setIsHistorySearchOpen((prev) => !prev)}
                                className={`p-2 rounded-lg border transition-colors ${
                                  historySearch.trim()
                                    ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-100"
                                    : "border-slate-700/60 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
                                }`}
                                title="Search chat history"
                              >
                                <Search className="w-4 h-4" />
                              </button>
                            </div>
                            {isHistorySearchOpen && (
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                  type="text"
                                  value={historySearch}
                                  onChange={(event) => setHistorySearch(event.target.value)}
                                  placeholder="Search history..."
                                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/50 border border-slate-700/60 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-400/50"
                                />
                              </div>
                            )}
                            {filteredConversations.length === 0 ? (
                              <p className="text-xs text-slate-400 px-1 py-2">
                                {conversations.length === 0 ? "No chats yet." : "No matching chats."}
                              </p>
                            ) : (
                              filteredConversations.map((conversation) => {
                                const isActive = conversation.id === activeConversationId;
                                return (
                                  <button
                                    key={`compact-${conversation.id}`}
                                    type="button"
                                    onClick={() => activateConversation(conversation.id)}
                                    className={`w-full text-left p-2.5 rounded-xl border ${
                                      isActive
                                        ? "border-cyan-400/50 bg-cyan-500/10"
                                        : "border-slate-700/60 bg-slate-900/40 hover:bg-slate-800/60"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-sm font-medium text-slate-100 line-clamp-1">
                                        {conversation.title}
                                      </p>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <Pin
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            togglePinConversation(conversation.id);
                                          }}
                                          className={`w-4 h-4 ${
                                            conversation.pinned ? "text-cyan-300 fill-cyan-300/40" : "text-slate-500"
                                          }`}
                                        />
                                        <Trash2
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            requestDeleteConversation(conversation);
                                          }}
                                          className="w-4 h-4 text-slate-500 hover:text-red-300"
                                        />
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-400 line-clamp-1 mt-1">
                                      {conversation.preview}
                                    </p>
                                  </button>
                                );
                              })
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="max-w-3xl mx-auto w-full mt-4 sm:mt-0">
                        <AIChatInterface messages={messages} isThinking={isThinking} />
                      </div>

                  {showProducts && (
                    <>
                      <div className="glass-strong rounded-2xl p-5 mt-2 border border-slate-700/50 refine-results-panel">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                          <div>
                            <h3 className="text-slate-100 text-base font-semibold">Refine Results</h3>
                            <p className="text-xs text-slate-400 mt-1">
                              Showing {filteredProductsCount} of {totalProductsCount} products
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={resetProductFilters}
                            className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/30 refine-reset-btn"
                          >
                            Reset Filters
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <input
                            type="text"
                            value={productFilters.search}
                            onChange={(e) => setProductFilters((prev) => ({ ...prev, search: e.target.value }))}
                            placeholder="Search in results..."
                            className="bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-100 refine-field"
                          />
                          <div className="text-sm text-slate-300 flex items-center gap-2 bg-slate-900/40 border border-slate-700/60 rounded-xl px-3 py-2.5 refine-field refine-field-wrap">
                            <span className="min-w-fit text-slate-300 pointer-events-none select-none">Match %</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={String(productFilters.minMatch ?? 0)}
                              onChange={(e) => {
                                const raw = String(e.target.value || "").replace(/[^0-9]/g, "");
                                const next = Math.max(0, Math.min(100, Number(raw || 0)));
                                setProductFilters((prev) => ({ ...prev, minMatch: next }));
                              }}
                              className="w-full bg-transparent outline-none text-slate-100 refine-field-input pointer-events-auto relative z-10"
                            />
                          </div>
                          <div className="text-sm text-slate-300 flex items-center gap-2 bg-slate-900/40 border border-slate-700/60 rounded-xl px-3 py-2.5 refine-field refine-field-wrap">
                            <span className="min-w-fit text-slate-300 pointer-events-none select-none">Min Price</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={productFilters.minPrice}
                              onChange={(e) => {
                                const raw = String(e.target.value || "").replace(/[^0-9.]/g, "");
                                setProductFilters((prev) => ({ ...prev, minPrice: raw }));
                              }}
                              className="w-full bg-transparent outline-none text-slate-100 refine-field-input pointer-events-auto relative z-10"
                            />
                          </div>
                          <div className="text-sm text-slate-300 flex items-center gap-2 bg-slate-900/40 border border-slate-700/60 rounded-xl px-3 py-2.5 refine-field refine-field-wrap">
                            <span className="min-w-fit text-slate-300 pointer-events-none select-none">Max Price</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={productFilters.maxPrice}
                              onChange={(e) => {
                                const raw = String(e.target.value || "").replace(/[^0-9.]/g, "");
                                setProductFilters((prev) => ({ ...prev, maxPrice: raw }));
                              }}
                              className="w-full bg-transparent outline-none text-slate-100 refine-field-input pointer-events-auto relative z-10"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-3">
                          <label className="text-sm text-slate-300 flex items-center gap-2 bg-slate-900/40 border border-slate-700/60 rounded-xl px-3 py-2 refine-field refine-field-wrap">
                            <span>Min Rating</span>
                            <select
                              value={productFilters.minRating}
                              onChange={(e) => setProductFilters((prev) => ({ ...prev, minRating: Number(e.target.value) }))}
                              className="bg-transparent text-slate-100 outline-none refine-field-input"
                            >
                              <option value={0}>Any</option>
                              <option value={3}>3+</option>
                              <option value={4}>4+</option>
                              <option value={4.5}>4.5+</option>
                            </select>
                          </label>

                          <label className="text-sm text-slate-300 flex items-center gap-2 bg-slate-900/40 border border-slate-700/60 rounded-xl px-3 py-2 refine-field refine-field-wrap">
                            <input
                              type="checkbox"
                              checked={productFilters.offerOnly}
                              onChange={(e) => setProductFilters((prev) => ({ ...prev, offerOnly: e.target.checked }))}
                              className="accent-cyan-400 refine-checkbox"
                            />
                            Offers only
                          </label>

                          <label className="text-sm text-slate-300 flex items-center gap-2 bg-slate-900/40 border border-slate-700/60 rounded-xl px-3 py-2 refine-field refine-field-wrap">
                            <span>Sort</span>
                            <select
                              value={productSort}
                              onChange={(e) => setProductSort(e.target.value)}
                              className="bg-transparent text-slate-100 outline-none refine-field-input"
                            >
                              <option value="match_desc">Best Match</option>
                              <option value="price_asc">Price: Low to High</option>
                              <option value="price_desc">Price: High to Low</option>
                              <option value="rating_desc">Rating</option>
                              <option value="reviews_desc">Most Reviewed</option>
                            </select>
                          </label>
                        </div>

                        {availablePlatforms.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-4">
                            {availablePlatforms.map((platform) => {
                              const active = productFilters.platforms.includes(platform);
                              return (
                                <button
                                  key={platform}
                                  type="button"
                                  onClick={() =>
                                    setProductFilters((prev) => ({
                                      ...prev,
                                      platforms: active
                                        ? prev.platforms.filter((p) => p !== platform)
                                        : [...prev.platforms, platform],
                                    }))
                                  }
                                  className={`px-3 py-1.5 text-xs rounded-full border refine-platform-chip ${
                                    active
                                      ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/50"
                                      : "bg-slate-800/70 text-slate-300 border-slate-600/70 hover:bg-slate-700/50"
                                  }`}
                                >
                                  {platform}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {filteredAndSortedProducts.length > 0 ? (
                        <div className="grid grid-cols-1 min-[540px]:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8 mt-2">
                          {filteredAndSortedProducts.map((p, i) => (
                            <ProductCard key={p._id || p.id || `${p.title}-${i}`} product={p} index={i} />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-4 mt-2">
                          <div className="glass-strong rounded-2xl p-6 text-slate-300">
                            {hasActiveProductFilters
                              ? "No products matched your current filters. Try adjusting filters or reset them."
                              : "No products are available for this request right now."}
                            {hasActiveProductFilters && (
                              <div className="mt-4 flex flex-wrap items-center gap-3">
                                <button
                                  type="button"
                                  onClick={resetProductFilters}
                                  className="text-sm px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700/30"
                                >
                                  Reset Filters
                                </button>
                                {fallbackAvailableProducts.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setShowUnfilteredFallback((prev) => !prev)}
                                    className="text-sm px-3 py-2 rounded-lg border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
                                  >
                                    {showUnfilteredFallback ? "Hide Available Products" : "Show Available Products"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {hasActiveProductFilters && showUnfilteredFallback && fallbackAvailableProducts.length > 0 && (
                            <div className="space-y-3">
                              <div className="text-sm text-slate-300">
                                Available products from this result set (unfiltered preview):
                              </div>
                              <div className="grid grid-cols-1 min-[540px]:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8">
                                {fallbackAvailableProducts.map((p, i) => (
                                  <ProductCard key={p._id || p.id || `fallback-${p.title}-${i}`} product={p} index={i} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                    </div>
                  </div>
                </div>

                <div
                  className="hidden sm:block fixed bottom-[9rem] sm:bottom-[10rem] md:bottom-36 left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100vw-1rem)]"
                  style={chatDesktopAnchorPx ? { left: `${chatDesktopAnchorPx}px` } : undefined}
                >
                  <button
                    type="button"
                    onClick={() => setStrictVisionMode((prev) => !prev)}
                    data-active={strictVisionMode ? "true" : "false"}
                    className={`strict-toggle-btn rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                      strictVisionMode
                        ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/50"
                        : "bg-slate-800/80 text-slate-300 border-slate-600/70"
                    }`}
                    title={strictVisionMode ? "Strict mode: exact type/category only" : "Broad mode: wider alternatives"}
                  >
                    {strictVisionMode ? "Strict Match: ON" : "Strict Match: OFF"}
                  </button>
                </div>

                <div className="sm:hidden fixed bottom-[10.35rem] left-1/2 -translate-x-1/2 z-[60]">
                  <button
                    type="button"
                    onClick={() => setStrictVisionMode((prev) => !prev)}
                    data-active={strictVisionMode ? "true" : "false"}
                    className={`strict-toggle-btn rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                      strictVisionMode
                        ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/50"
                        : "bg-slate-800/80 text-slate-300 border-slate-600/70"
                    }`}
                    title={strictVisionMode ? "Strict mode: exact type/category only" : "Broad mode: wider alternatives"}
                  >
                    {strictVisionMode ? "Strict Match: ON" : "Strict Match: OFF"}
                  </button>
                </div>

                <MultiModalInputDock
                  onSubmit={handleQuerySubmit}
                  isSubmitting={isThinking}
                  desktopAnchorPx={chatDesktopAnchorPx}
                />
                <ConfirmDialog
                  open={Boolean(pendingConversationDelete)}
                  title="Delete conversation?"
                  description={
                    pendingConversationDelete
                      ? `This will permanently remove "${pendingConversationDelete.title}".`
                      : ""
                  }
                  confirmLabel="Delete"
                  cancelLabel="Cancel"
                  danger
                  onCancel={() => setPendingConversationDelete(null)}
                  onConfirm={() => {
                    if (pendingConversationDelete?.id) {
                      deleteConversation(pendingConversationDelete.id);
                    }
                    setPendingConversationDelete(null);
                  }}
                />
              </>
            ) : <Navigate to="/login" />
          } />


          {/* USER PAGES */}
          <Route path="/discover" element={isAuthenticated ? <DiscoveryFeed /> : <Navigate to="/login" />} />
          <Route
            path="/compare"
            element={
              isAuthenticated
                ? <ComparisonView products={recommendedProducts} allProducts={recommendedProducts} />
                : <Navigate to="/login" />
            }
          />
          <Route path="/saved" element={isAuthenticated ? <SavedProducts /> : <Navigate to="/login" />} />
          <Route path="/analytics" element={isAuthenticated ? <AnalyticsDashboard /> : <Navigate to="/login" />} />
          <Route path="/profile" element={isAuthenticated ? <UserProfile /> : <Navigate to="/login" />} />

          <Route path="*" element={<Navigate to="/" />} />

        </Routes>
      </main>

      {isAuthenticated && !isAdmin && <MobileNav />}
    </div>
  );
}
