---
name: add-product
description: Add, edit or remove a product in data/catalog.json and keep its image in sync. Use whenever the user wants to change the product list or prices.
---

# add-product

Safely modify the product catalog.

## Product schema (data/catalog.json)

```json
{
  "id": "W01",                    // unique, short; K=kids, G=girls, W=women prefix + number
  "name": "Soft Cotton Kurti",
  "category": "women",            // kids | girls | women (boys | men reserved for future)
  "price": 799,                    // rupees, integer
  "sizes": ["S", "M", "L", "XL"],
  "occasions": ["daily", "office"], // from: daily, party, birthday, wedding, festive, office
  "fabric": "cotton",
  "bestseller": false,
  "why": "",                      // REQUIRED non-empty one-line selling reason when bestseller=true
  "image": "W01.png"              // file in data/images/
}
```

## Steps

1. Ask the user for any missing field (id/category/price/sizes at minimum). Do not invent prices.
2. Edit `data/catalog.json` — keep valid JSON, unique ids, and the schema above.
3. Image:
   - If the user provides a real photo, copy it to `data/images/<id>.png` (or .jpg — then set `image` accordingly).
   - Otherwise run `npm run gen-images` — it only creates placeholders for products whose image file is missing, so existing real photos are never overwritten.
4. Sanity-check: `node -e "require('./src/catalog.js').loadCatalog()"` must not throw.
5. Run the test-and-fix skill (menu tests read the catalog).
6. Run the update-docs skill.

## Rules

- Keep exactly 2–4 products flagged `bestseller: true` at any time (the agent recommends 2).
- Never leave `why` empty on a bestseller.
