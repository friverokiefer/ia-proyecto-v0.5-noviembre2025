// backend/test/iaEngine.test.ts
import { IA_ENGINE_BASE_URL } from "../src/services/iaEngine";

(async () => {
  const url = `${IA_ENGINE_BASE_URL}/ia/generate`;

  const payload = {
    engine: "anthropic",
    campaign: "Crédito de consumo",
    cluster: "Viajeros - Soltero",
    trios: 2,
    feedback: {
      subject: "algo más juvenil",
      bodyContent: "quiero algo fresco"
    }
  };

  console.log("=== Test IA Engine ===");
  console.log("POST:", url);
  console.log("Payload:", payload);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  console.log("Status:", res.status);

  const json = await res.json().catch(() => null);
  console.log("Response JSON:\n", JSON.stringify(json, null, 2));

})();
