/**
 * Pincode lookup utility using the public India Post API.
 * https://api.postalpincode.in/pincode/{PINCODE}
 * Returns all post offices for a given pincode.
 */

export async function fetchPincodeData(pincode) {
  if (!pincode || String(pincode).length !== 6 || !/^\d{6}$/.test(String(pincode))) {
    return null;
  }
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (
      Array.isArray(data) &&
      data[0]?.Status === "Success" &&
      data[0]?.PostOffice?.length > 0
    ) {
      const offices = data[0].PostOffice;
      const first = offices[0];
      return {
        valid: true,
        state: first.State || "",
        city: first.District || "",
        area: first.Name || "",
        country: first.Country || "India",
        // All area names for multi-select
        areas: offices.map(o => o.Name).filter(Boolean),
      };
    }
    return { valid: false };
  } catch {
    return null;
  }
}

