/**
 * Pincode lookup utility using the public India Post API.
 * https://api.postalpincode.in/pincode/{PINCODE}
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
      const office = data[0].PostOffice[0];
      return {
        valid: true,
        state: office.State || "",
        city: office.District || "",
        area: office.Name || "",
        country: office.Country || "India",
      };
    }
    return { valid: false };
  } catch {
    return null;
  }
}
