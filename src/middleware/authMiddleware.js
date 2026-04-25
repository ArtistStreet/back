const jwt = require("jsonwebtoken");
const User = require("../models/User");

const normalizeBearerToken = (rawValue) => {
  if (!rawValue) return "";
  const normalized = String(rawValue)
    .trim()
    .replace(/^"+|"+$/g, "");
  if (!normalized || normalized === "null" || normalized === "undefined") {
    return "";
  }
  return normalized;
};

const resolveDecodedToken = (token) => {
  const legacySecrets = String(process.env.JWT_LEGACY_SECRETS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const candidateSecrets = [
    process.env.JWT_SECRET,
    ...legacySecrets,
    "shopee_secret",
    "ShopBee_secret",
  ].filter(Boolean);

  let lastError = null;
  for (const secret of candidateSecrets) {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Token verification failed");
};

const protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = normalizeBearerToken(req.headers.authorization.split(" ")[1]);
      if (!token) {
        return res.status(401).json({ message: "Not authorized, no token" });
      }
      const decoded = resolveDecodedToken(token);
      req.user = await User.findById(decoded.id).select("-password");
      if (!req.user) {
        return res
          .status(401)
          .json({ message: "Not authorized, user missing" });
      }
      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

const optionalProtect = async (req, _res, next) => {
  if (
    !req.headers.authorization ||
    !req.headers.authorization.startsWith("Bearer")
  ) {
    return next();
  }

  try {
    const token = normalizeBearerToken(req.headers.authorization.split(" ")[1]);
    if (!token) return next();
    const decoded = resolveDecodedToken(token);
    const user = await User.findById(decoded.id).select("-password");
    if (user) {
      req.user = user;
    }
  } catch (_error) {
    // Keep this route public: ignore invalid token and continue.
  }
  return next();
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(401).json({ message: "Not authorized as an admin" });
  }
};

const isSeller = (req, res, next) => {
  if (req.user && (req.user.role === "seller" || req.user.role === "admin")) {
    next();
  } else {
    res.status(401).json({ message: "Not authorized as a seller" });
  }
};

module.exports = { protect, optionalProtect, admin, isSeller };
