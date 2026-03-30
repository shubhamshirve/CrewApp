/**
 * Shared validation & sanitization helpers for CrewBook forms.
 */

// ── Sanitizers ────────────────────────────────────────────────────────────────

/** Remove leading/trailing whitespace and collapse inner spaces */
export const sanitizeText = (v = "") =>
  String(v).trim().replace(/\s{2,}/g, " ");

/** Strip all HTML/script tags (safe display text) */
export const sanitizeHtml = (v = "") =>
  String(v).replace(/<[^>]*>/g, "").trim();

/** Sanitize and normalize an email address */
export const sanitizeEmail = (v = "") =>
  String(v).trim().toLowerCase();

/** Keep only digits */
export const sanitizeDigits = (v = "") =>
  String(v).replace(/\D/g, "");

// ── Validators (return string error or "") ────────────────────────────────────

export const required = (v, label = "This field") =>
  !String(v ?? "").trim() ? `${label} is required` : "";

export const minLength = (v, min, label = "This field") =>
  String(v ?? "").trim().length < min
    ? `${label} must be at least ${min} characters`
    : "";

export const maxLength = (v, max, label = "This field") =>
  String(v ?? "").trim().length > max
    ? `${label} must be ${max} characters or fewer`
    : "";

export const validateEmail = (v = "") => {
  if (!v.trim()) return "Email is required";
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(v.trim()) ? "" : "Enter a valid email address";
};

export const validatePhone = (v = "") => {
  if (!v.trim()) return "Phone number is required";
  const digits = sanitizeDigits(v);
  if (digits.length < 7 || digits.length > 15)
    return "Phone must be 7–15 digits";
  return "";
};

export const validateIndianPhone = (v = "") => {
  if (!v.trim()) return "Mobile number is required";
  const digits = sanitizeDigits(v);
  if (digits.length !== 10) return "Enter a valid 10-digit mobile number";
  if (!/^[6-9]/.test(digits)) return "Indian mobile numbers start with 6–9";
  return "";
};

export const validatePassword = (v = "") => {
  if (!v) return "Password is required";
  if (v.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(v)) return "Password must contain at least one letter";
  if (!/\d/.test(v)) return "Password must contain at least one number";
  return "";
};

export const validatePincode = (v = "") => {
  const digits = sanitizeDigits(v);
  if (!digits) return "Pincode is required";
  if (digits.length !== 6) return "Enter a valid 6-digit pincode";
  return "";
};

export const validateUrl = (v = "") => {
  if (!v || !v.trim()) return ""; // optional
  try {
    const url = new URL(v.trim());
    if (!["http:", "https:"].includes(url.protocol))
      return "URL must start with http:// or https://";
    return "";
  } catch {
    return "Enter a valid URL (e.g. https://example.com)";
  }
};

export const validateUpi = (v = "") => {
  if (!v || !v.trim()) return ""; // optional
  // UPI format: alphanumeric@bank or number@bankname
  const re = /^[\w.\-+]+@[\w.\-]+$/;
  return re.test(v.trim()) ? "" : "Invalid UPI ID (e.g. name@upi or 9876543210@ybl)";
};

export const validateFee = (v, label = "Fee") => {
  if (!v && v !== 0) return `${label} is required`;
  const n = parseFloat(v);
  if (isNaN(n) || n <= 0) return `${label} must be a positive number`;
  if (n > 500000) return `${label} cannot exceed ₹5,00,000`;
  return "";
};

export const validatePositiveInt = (v, label = "Value") => {
  if (!v && v !== 0) return `${label} is required`;
  const n = parseInt(v);
  if (isNaN(n) || n <= 0) return `${label} must be a positive whole number`;
  return "";
};

export const validateDate = (v = "", label = "Date") => {
  if (!v) return `${label} is required`;
  const d = new Date(v);
  if (isNaN(d.getTime())) return `${label} is invalid`;
  return "";
};

export const validateFutureDate = (v = "", label = "Date") => {
  const err = validateDate(v, label);
  if (err) return err;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(v) < today) return `${label} cannot be in the past`;
  return "";
};

export const validateTimeRange = (start = "", end = "") => {
  if (!start || !end) return "";
  if (start >= end) return "End time must be after start time";
  return "";
};

export const validateName = (v = "", label = "Name") => {
  const s = sanitizeText(v);
  if (!s) return `${label} is required`;
  if (s.length < 2) return `${label} must be at least 2 characters`;
  if (s.length > 100) return `${label} must be 100 characters or fewer`;
  return "";
};

export const validateBio = (v = "") => {
  if (!v) return "";
  if (v.length > 1000) return "Bio must be 1000 characters or fewer";
  return "";
};

// ── Batch helper ──────────────────────────────────────────────────────────────

/**
 * Run multiple validators and return the first error message found.
 * @param {string} value
 * @param  {...Function} validators
 */
export const validate = (value, ...validators) => {
  for (const fn of validators) {
    const err = fn(value);
    if (err) return err;
  }
  return "";
};
